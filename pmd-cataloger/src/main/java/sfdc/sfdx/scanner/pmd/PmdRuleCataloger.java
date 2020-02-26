package sfdc.sfdx.scanner.pmd;

import java.io.*;
import java.util.*;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;
import org.w3c.dom.*;
import sfdc.sfdx.scanner.pmd.catalog.PmdCatalogCategory;
import sfdc.sfdx.scanner.pmd.catalog.PmdCatalogJson;
import sfdc.sfdx.scanner.pmd.catalog.PmdCatalogRule;
import sfdc.sfdx.scanner.pmd.catalog.PmdCatalogRuleset;
import sfdc.sfdx.scanner.xml.XmlReader;
import sfdc.sfdx.scanner.ExitCode;

class PmdRuleCataloger {
  private String pmdVersion;
  private String pmdPath;
  private String customClasspathMapping;
  private List<String> languages;

  // Holds category and rulesets maps that provide files we need to scan for each language.
  private LanguageXmlFileMapping languageXmlFileMapping = LanguageXmlFileMapping.getInstance();

  // These maps are going to help us store intermediate objects in an easy-to-reference way.
  private Map<String,List<PmdCatalogRule>> rulesByLanguage = new HashMap<>();
  private Map<String,List<PmdCatalogRuleset>> rulesetsByLanguage = new HashMap<>();

  // These lists are going to be the master lists that we ultimately use to build our JSON at the end.
  private List<PmdCatalogCategory> masterCategoryList = new ArrayList<>();
  private List<PmdCatalogRule> masterRuleList = new ArrayList<>();
  private List<PmdCatalogRuleset> masterRulesetList = new ArrayList<>();


  /**
   *
   * @param pmdVersion   - The version of PMD being used, e.g. 6.20.0.
   * @param pmdPath      - The path to PMD's lib folder.
   * @param languages    - The languages whose rules should be catalogued.
   */
  PmdRuleCataloger(String pmdVersion, String pmdPath, List<String> languages, String customClasspathMapping) {
    this.pmdVersion = pmdVersion;
    this.pmdPath = pmdPath;
    this.languages = languages;
    this.customClasspathMapping = customClasspathMapping;
  }


  /**
   * Builds a catalog describing all of the rules, rulesets, and categories defined by PMD for the used languages, and
   * stores them in a JSON file.
   */
  void catalogRules() {
    //Check for custom rules and process them

    // STEP 1: Identify all of the ruleset and category files for each language we're looking at.
    addPmdRules();
    addCustomRules();

    // STEP 2: Process the category files to derive category and rule representations.
    final Map<String, Set<String>> categoryPathsByLanguage = this.languageXmlFileMapping.getCategoryPaths();
    for (String language : categoryPathsByLanguage.keySet()) {
      final Set<String> categoryPaths = categoryPathsByLanguage.get(language);
      for (String categoryPath : categoryPaths) {
        processCategoryFile(language, categoryPath);
      }
    }

    // STEP 3: Process the ruleset files.
    final Map<String, Set<String>> rulesetPathsByLanguage = this.languageXmlFileMapping.getRulesetPaths();
    for (String language : rulesetPathsByLanguage.keySet()) {
      Set<String> rulesetPaths = rulesetPathsByLanguage.get(language);
      // STEP 3A: For each ruleset, generate a representation.
      for (String rulesetPath : rulesetPaths) {
        generateRulesetRepresentation(language, rulesetPath);
      }
      // STEP 3B: Create links between dependent rulesets.
      linkDependentRulesets(rulesetsByLanguage.get(language));
    }

    // STEP 4: Link rules to the rulesets that reference them.
    for (String language : rulesetsByLanguage.keySet()) {
      List<PmdCatalogRuleset> rulesets = rulesetsByLanguage.get(language);
      List<PmdCatalogRule> rules = rulesByLanguage.get(language);
      linkRulesToRulesets(rules, rulesets);
    }

    // STEP 5: Build a JSON using all of our objects.
    PmdCatalogJson json = new PmdCatalogJson(masterRuleList, masterCategoryList, masterRulesetList);

    // STEP 6: Write the JSON to a file.
    writeJsonToFile(json);
  }


  /**
   * Returns the name of the JAR in which PMD stores rule definitions for the specified language.
   * @param language - The language for which we should find the corresponding PMD JAR.
   * @return         - The name of the corresponding JAR.
   */
  private String deriveJarNameForLanguage(String language) {
    return "pmd-" + language + "-" + this.pmdVersion + ".jar";
  }

  void addPmdRules() {
    this.languages.forEach(language -> addPmdRules(language));

  }

  void addPmdRules(String language) {
    final String jarPath = this.pmdPath + File.separator + this.deriveJarNameForLanguage(language);

    final XmlFileFinder xmlFileFinder = new XmlFileFinder();
    List<String> xmlFiles = xmlFileFinder.findXmlFilesInJar(jarPath);
    languageXmlFileMapping.addPathsForLanguage(xmlFiles, language);
  }

  void addCustomRules() {
    // Parse custom rules json into a Map
    Map<String, List<String>> languageMap = parseCustomRulesRegister();

    final XmlFileFinder xmlFileFinder = new XmlFileFinder();
    languageMap.keySet().forEach(language -> {
      List<String> filePaths = languageMap.get(language);
      filePaths.forEach(filePath -> {
        List<String> xmlFiles = xmlFileFinder.findXmlFilesInPath(filePath);
        languageXmlFileMapping.addPathsForLanguage(xmlFiles, language);
      });
    });

  }


  /**
   * Parses Custom classpath mapping json into a Map
   * Sample json:
   * {
   *     "apex": [
   *         "/Users/rmohan/Development/pmdTry/myCustomRule/customRule3.jar",
   *         "/Users/rmohan/Development/pmdTry/myCustomRule/customRule2.jar"
   *     ],
   *     "java": [
   *         "/Users/rmohan/Development/pmdTry/java/customRules/lib"
   *     ]
   * }
   * @return
   */
  Map<String, List<String>> parseCustomRulesRegister() {
    Map<String, List<String>> languageMap = new HashMap<>();

    try {
      JSONParser parser = new JSONParser();
      JSONObject jsonObject = (JSONObject) parser.parse(customClasspathMapping);

      Set<String> languageSet = jsonObject.keySet();

      languageSet.forEach(language -> {
        JSONArray languageFiles = (JSONArray) jsonObject.get(language);
        languageMap.put(language, languageFiles.subList(0, languageFiles.size()));
      });
    } catch (ParseException e) {
      System.err.println("Exception occurred while parsing custom classpath mapping");
      System.exit(ExitCode.CLASSPATH_JSON_PARSE_EXCEPTION.getCode());
    }

    return languageMap;
  }

  private void processCategoryFile(String language, String path) {
    // STEP 1: Turn the category file's XML into a Document object with a Root Element that we can actually use.
    Document doc = XmlReader.getInstance().getDocumentFromPath(path);
    Element root = doc.getDocumentElement();

    // STEP 2: Use the root element to derive a Category representation, and put it in the master list.
    String categoryName = root.getAttribute("name");
    PmdCatalogCategory category = new PmdCatalogCategory(categoryName, path);
    this.masterCategoryList.add(category);

    // STEP 3: Get the "rule"-type nodes and use them to create Rule representations, which we should map to the target
    // language and also put in the master list.
    NodeList ruleNodes = root.getElementsByTagName("rule");
    List<PmdCatalogRule> rules = new ArrayList<>();
    int ruleCount = ruleNodes.getLength();
    for (int i = 0; i < ruleCount; i++) {
      Element ruleNode = (Element) ruleNodes.item(i);
      PmdCatalogRule rule = new PmdCatalogRule(ruleNode, category, language);
      rules.add(rule);
    }
    if (!this.rulesByLanguage.containsKey(language)) {
      this.rulesByLanguage.put(language, new ArrayList<>());
    }
    this.rulesByLanguage.get(language).addAll(rules);
    this.masterRuleList.addAll(rules);
  }

  private void generateRulesetRepresentation(String language, String path) {
    // STEP 1: Turn the ruleset file's XML into a Document object with a Root Element that we can actually use.
    Document doc = XmlReader.getInstance().getDocumentFromPath(path);
    Element root = doc.getDocumentElement();

    // STEP 2: Use the root element to derive a Ruleset representation, which we should map to the target language and
    // also put in the master list.
    PmdCatalogRuleset ruleset = new PmdCatalogRuleset(root, path);
    if (!this.rulesetsByLanguage.containsKey(language)) {
      this.rulesetsByLanguage.put(language, new ArrayList<>());
    }
    this.rulesetsByLanguage.get(language).add(ruleset);
    masterRulesetList.add(ruleset);
  }

  private void linkDependentRulesets(List<PmdCatalogRuleset> rulesets) {
    // Map the rulesets by their path.
    Map<String,PmdCatalogRuleset> rulesetsByPath = new HashMap<>();
    for (PmdCatalogRuleset ruleset : rulesets) {
      rulesetsByPath.put(ruleset.getPath(), ruleset);
    }

    // Next, feed the map into each ruleset to see which ones it depends on.
    for (PmdCatalogRuleset ruleset : rulesets) {
      ruleset.processDependencies(rulesetsByPath);
    }
  }

  private void linkRulesToRulesets(List<PmdCatalogRule> rules, List<PmdCatalogRuleset> rulesets) {
    for (PmdCatalogRule rule : rules) {
      for (PmdCatalogRuleset ruleset : rulesets) {
        ruleset.processRule(rule);
      }
    }
  }

  private void writeJsonToFile(PmdCatalogJson json) {
    File catalogDirectory = new File("./catalogs");
    catalogDirectory.mkdir();
    try (
      FileWriter file = new FileWriter("./catalogs/PmdCatalog.json")
    ) {
      file.write(json.constructJson().toString());
    } catch (IOException ioe) {
      System.err.println("Failed to write JSON to file: " + ioe.getMessage());
      System.exit(ExitCode.JSON_WRITE_EXCEPTION.getCode());
    }
  }
}
