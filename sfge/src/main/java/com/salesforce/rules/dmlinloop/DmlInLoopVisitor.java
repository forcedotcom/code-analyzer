package com.salesforce.rules.dmlinloop;

import com.salesforce.graph.symbols.SymbolProvider;
import com.salesforce.graph.vertex.*;
import com.salesforce.rules.DmlUtil;
import com.salesforce.rules.Violation;
import com.salesforce.rules.ops.visitor.LoopDetectionVisitor;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class DmlInLoopVisitor extends LoopDetectionVisitor {

    private static final Logger LOGGER = LogManager.getLogger(DmlInLoopVisitor.class);

    /** Represents the path entry point that this visitor is walking */
    private final SFVertex sourceVertex;

    /** Represents the DML statement that is possibly inside a loop */
    private final BaseSFVertex sinkVertex;

    /** Collects violation information */
    private final HashSet<Violation.PathBasedRuleViolation> violations;

    // DmlStatementVertex represents statements like insert a;
    DmlInLoopVisitor(SFVertex sourceVertex, DmlStatementVertex sinkVertex) {
        this.sourceVertex = sourceVertex;
        this.sinkVertex = sinkVertex;
        this.violations = new HashSet<>();
    }

    // MethodCallExpressionVertex is necessary to detect Database.<whatever> methods
    DmlInLoopVisitor(SFVertex sourceVertex, MethodCallExpressionVertex sinkVertex) {
        this.sourceVertex = sourceVertex;
        this.sinkVertex = sinkVertex;
        this.violations = new HashSet<>();
    }

    // DmlStatementVertex represents statements like [SELECT Id, Age FROM Accounts]
    DmlInLoopVisitor(SFVertex sourceVertex, SoqlExpressionVertex sinkVertex) {
        this.sourceVertex = sourceVertex;
        this.sinkVertex = sinkVertex;
        this.violations = new HashSet<>();
    }

    @Override
    public void afterVisit(MethodCallExpressionVertex vertex, SymbolProvider symbols) {

        final String fullMethodName = vertex.getFullMethodName();

        // we know this is a method call/expression vertex, but we need to see
        // if it is a Database.<method> call to confirm it is a DML operation
        // if so, confirm it should be a violation in a loop
        DmlUtil.DatabaseOperation.fromString(fullMethodName)
                .ifPresent(
                        op -> {
                            if (op.isLoopIsViolation()) {
                                createViolationIfSinkInsideLoop(vertex, symbols);
                            }
                        });

        // Perform super method's logic as well to remove exclusion boundary if needed.
        super.afterVisit(vertex, symbols);
    }

    // for all of these DmlStatementVertex implemenetations, we need these
    // so that the afterVisit method will resolve correctly,
    // and not to the parent classes generic afterVisit(BaseSFVertex).
    public void afterVisit(DmlDeleteStatementVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);
    }

    public void afterVisit(DmlInsertStatementVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);
    }

    public void afterVisit(DmlUndeleteStatementVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);
    }

    public void afterVisit(DmlUpdateStatementVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);
    }

    public void afterVisit(DmlUpsertStatementVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);
    }

    public void afterVisit(DmlMergeStatementVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);
    }

    public void afterVisit(SoqlExpressionVertex vertex, SymbolProvider symbols) {
        createViolationIfSinkInsideLoop(vertex, symbols);

        // Perform super method's logic as well to remove exclusion boundary if needed.
        super.afterVisit(vertex, symbols);
    }

    private void createViolationIfSinkInsideLoop(SFVertex vertex, SymbolProvider symbols) {
        if (vertex != null && vertex.equals(sinkVertex)) {
            final Optional<? extends SFVertex> loopedVertexOpt = isInsideLoop();
            if (loopedVertexOpt.isPresent()) {
                // this is only a violation if we're inside a loop
                createViolation(loopedVertexOpt.get());
            }
        }
    }

    /**
     * Logs a violation
     *
     * @param loopVertex the vertex at which the violation (loop) was detected
     */
    private void createViolation(SFVertex loopVertex) {

        violations.add(
                new Violation.PathBasedRuleViolation(
                        DmlInLoopUtil.getMessage(loopVertex), sourceVertex, sinkVertex));
    }

    /**
     * @return Violations collected by the rule.
     */
    Set<Violation.PathBasedRuleViolation> getViolations() {
        return violations;
    }
}
