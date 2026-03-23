/**
 * Test class demonstrating inline suppression markers
 */
public class TestClass {
    
    // This method has no ApexDoc - should trigger violation
    public void methodWithoutDoc() {
        System.debug('No suppression here');
    }
    
    // code-analyzer-suppress(pmd:ApexDoc)
    // This method has no ApexDoc but is suppressed - should NOT trigger violation
    public void suppressedMethod() {
        System.debug('Suppressed');
    }
    
    // code-analyzer-suppress
    // All rules suppressed for this method
    public void allSuppressedMethod() {
        System.debug('All suppressed');
    }
    
    // code-analyzer-unsuppress
    // Back to normal - should trigger violation again
    public void unsuppressedMethod() {
        System.debug('Back to normal');
    }
}
