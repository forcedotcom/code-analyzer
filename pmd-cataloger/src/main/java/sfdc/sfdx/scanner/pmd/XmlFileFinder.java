package sfdc.sfdx.scanner.pmd;

import sfdc.sfdx.scanner.ExitCode;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/***
 * Examines files and helps scout for jar files and XMLs
 * @author rmohan
 * Feb 2020
 */
public class XmlFileFinder {

  enum FileType {
    JAR(".jar"),
    XML(".xml");

    String suffix;

    FileType(String suffix) {
      this.suffix = suffix;
    }
  }


  /***
   * Find XML in a given path
   * @param pathString - could be a directory with classes and/or jar files, or a single jar file
   * @return a list of XML files found
   */
  public List<String> findXmlFilesInPath(String pathString) {

    final List<String> xmlFiles = new ArrayList<>();
    final List<String> jarFiles = new ArrayList<>();

    final Path path = Paths.get(pathString);

    // Make sure that the path exists to begin with
    if (!Files.exists(path)) {
      System.err.println("Path does not exist: " + path.getFileName());
      System.exit(ExitCode.CLASSPATH_DOES_NOT_EXIST.getCode());
    }


    if (Files.isDirectory(path)) {
      // Recursively walk through the directory and scout for XML/JAR files
      xmlFiles.addAll(scoutForFiles(FileType.XML, path));
      jarFiles.addAll(scoutForFiles(FileType.JAR, path));

    } else if (Files.isRegularFile(path)
      && path.toString().endsWith(FileType.JAR.suffix)) { // Check if the path we have is a jar file

      jarFiles.add(path.toString());
    }

    jarFiles.forEach(jarPath -> xmlFiles.addAll(findXmlFilesInJar(jarPath)));

    return xmlFiles;
  }


  public List<String> findXmlFilesInJar(String jarPath) {

    final List<String> xmlFiles = new ArrayList<String>();
    try (
      JarInputStream jstream = new JarInputStream(new FileInputStream(jarPath));
    ) {

      JarEntry entry;
      while ((entry = jstream.getNextJarEntry()) != null) {
        String fName = entry.getName();
        // For now, take all .xml files. We can ignore non-ruleset XMLs while parsing
        if (fName.endsWith(FileType.XML.suffix)) {
          xmlFiles.add(fName);
        }
      }
    } catch (Exception e) {
      //TODO: add logging and print stacktrace for debugging
      System.err.println("Unable to read resource JAR " + jarPath);
      System.exit(ExitCode.JAR_READ_FAILED.getCode());
    }

    return xmlFiles;
  }

  private List<String> scoutForFiles(FileType fileType, Path path) {
    final List<String> filesFound = new ArrayList<>();

    // Create a stream of Paths for the contents of the directory
    try (Stream<Path> walk = Files.walk(path)) {

      // Filter the stream to find only Paths that match the filetype we are looking
      filesFound.addAll( walk.map(x -> x.toString())
        .filter(f -> f.endsWith(fileType.suffix)).collect(Collectors.toList()));
    } catch (IOException e) {
      System.err.println("Error parsing directory: " + path);
      System.exit(ExitCode.DIRECTORY_READ_EXCEPTION.getCode());
    }

    return filesFound;
  }
}
