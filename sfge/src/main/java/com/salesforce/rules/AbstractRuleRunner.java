package com.salesforce.rules;

import com.salesforce.apex.jorje.ASTConstants;
import com.salesforce.exception.ProgrammingException;
import com.salesforce.graph.JustInTimeGraphProvider;
import com.salesforce.graph.Schema;
import com.salesforce.graph.build.CaseSafePropertyUtil.H;
import com.salesforce.graph.vertex.MethodVertex;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversal;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.__;
import org.apache.tinkerpop.gremlin.structure.Vertex;

@SuppressWarnings("PMD.AbstractClassWithoutAbstractMethod")
public abstract class AbstractRuleRunner {
    private static final Logger LOGGER = LogManager.getLogger(AbstractRuleRunner.class);
    private final GraphTraversalSource g;

    protected AbstractRuleRunner(GraphTraversalSource g) {
        this.g = g;
    }

    public List<Violation> runRules(List<AbstractRule> rules) {
        return runRules(rules, new ArrayList<>());
    }

    public List<Violation> runRules(List<AbstractRule> rules, List<RuleRunnerTarget> targets) {
        Set<Violation> violations = new TreeSet<>();

        violations.addAll(
                runStaticRules(
                        rules.stream()
                                .filter(r -> r instanceof AbstractStaticRule)
                                .map(r -> (AbstractStaticRule) r)
                                .collect(Collectors.toList()),
                        targets));

        violations.addAll(
                runPathBasedRules(
                        rules.stream()
                                .filter(r -> r instanceof AbstractPathBasedRule)
                                .map(r -> (AbstractPathBasedRule) r)
                                .collect(Collectors.toList()),
                        targets));

        return new ArrayList<>(violations);
    }

    private Set<Violation> runStaticRules(
            List<AbstractStaticRule> rules, List<RuleRunnerTarget> targets) {
        Set<Violation> allViolations = new HashSet<>();
        if (rules.isEmpty()) {
            return allViolations;
        }

        for (AbstractStaticRule rule : rules) {
            for (Violation violation : rule.run(g, targets)) {
                // Violations aren't created with all of their properties filled in. Some properties
                // must be populated
                // using the rule that created them.
                if (violation instanceof Violation.RuleViolation) {
                    ((Violation.RuleViolation) violation).setPropertiesFromRule(rule);
                }
                allViolations.add(violation);
            }
        }

        return allViolations;
    }

    private Set<Violation> runPathBasedRules(
            List<AbstractPathBasedRule> rules, List<RuleRunnerTarget> targets) {
        if (rules.isEmpty()) {
            return new HashSet<>();
        }
        List<MethodVertex> pathEntryPoints = RuleUtil.getPathEntryPoints(g, targets);
        if (pathEntryPoints.isEmpty()) {
            LOGGER.info("No path-based entry points found");
            return new HashSet<>();
        }

        // For each entry point, generate a submission object.
        List<ThreadableRuleExecutor.ThreadableRuleSubmission> submissions = new ArrayList<>();
        for (MethodVertex pathEntryPoint : pathEntryPoints) {
            submissions.add(getRuleRunnerSubmission(g, pathEntryPoint, rules));
        }
        return ThreadableRuleExecutor.run(submissions);
    }

    /**
     * @return the submission that matches the inputs. This is broken out to allow tests to provide
     *     a customized subclass of {@code RuleRunnerSubmission}
     */
    protected RuleRunnerSubmission getRuleRunnerSubmission(
            GraphTraversalSource fullGraph,
            MethodVertex pathEntry,
            List<AbstractPathBasedRule> rules) {
        return new RuleRunnerSubmission(g, pathEntry, rules);
    }

    protected class RuleRunnerSubmission
            implements ThreadableRuleExecutor.ThreadableRuleSubmission {
        private final GraphTraversalSource fullGraph;
        private GraphTraversalSource graph;
        private final MethodVertex pathEntry;
        private final List<AbstractPathBasedRule> rules;

        public RuleRunnerSubmission(
                GraphTraversalSource fullGraph,
                MethodVertex pathEntry,
                List<AbstractPathBasedRule> rules) {
            this.fullGraph = fullGraph;
            this.pathEntry = pathEntry;
            this.rules = rules;
        }

        @Override
        public GraphTraversalSource getGraph() {
            // If the thread locals haven't been initialized yet, then this method can't return any
            // meaningful results.
            if (graph == null) {
                throw new ProgrammingException(
                        "RuleRunnerSubmission.getGraph() should not be called before RuleRunnerSubmission.initializeThreadLocals()");
            }
            return graph;
        }

        @Override
        public MethodVertex getPathEntry() {
            return pathEntry;
        }

        @Override
        public List<AbstractPathBasedRule> getRules() {
            return rules;
        }

        @Override
        public void initializeThreadLocals() {
            if (graph == null) {
                graph = JustInTimeGraphProvider.create(fullGraph, pathEntry.getDefiningType());
            } else {
                throw new ProgrammingException(
                        "AbstractRuleRunner.initializeThreadLocals() should only be called once");
            }
        }

        @Override
        public String toString() {
            return "RuleRunnerSubmission{" + "pathEntry=" + pathEntry + ", rules=" + rules + '}';
        }
    }

    public static final class RuleRunnerTarget {
        private final String targetFile;
        private final List<String> targetMethods;

        public RuleRunnerTarget(String targetFile, List<String> targetMethods) {
            this.targetFile = targetFile;
            this.targetMethods = targetMethods;
        }

        /** Get the name of the file that this target represents. */
        public String getTargetFile() {
            return targetFile;
        }

        /**
         * The names of specific methods in the target file that should be scanned. An empty array
         * indicates default targeting.
         */
        public List<String> getTargetMethods() {
            return targetMethods;
        }

        /**
         * Given a traversal, expands the traversal to include all vertices described by the
         * provided target.
         *
         * @param rootTraversal - An in-progress traversal, whose vertices MUST contain the root
         *     vertex of the targeted file.
         */
        public GraphTraversal<Vertex, Vertex> createTraversal(
                GraphTraversal<Vertex, Vertex> rootTraversal) {
            // If this target doesn't include any explicitly named methods, then every vertex in the
            // file is returned.
            if (targetMethods.isEmpty()) {
                return rootTraversal
                        .has(Schema.FILE_NAME, targetFile)
                        .union(__.identity(), __.repeat(__.out(Schema.CHILD)).emit());
            } else {
                // If there are methods being targeted, then we recurse down through the children
                // looking for those methods,
                // and once the methods are found, they and all their child-vertices are returned.
                return rootTraversal
                        .has(Schema.FILE_NAME, targetFile)
                        .repeat(__.out(Schema.CHILD))
                        .until(
                                H.hasWithin(
                                        ASTConstants.NodeType.METHOD, Schema.NAME, targetMethods))
                        .union(__.identity(), __.repeat(__.out(Schema.CHILD)).emit());
            }
        }
    }
}
