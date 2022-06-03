package sfdc.sfdx.scanner.pmd;

import java.util.Arrays;
import java.util.Optional;

import org.hamcrest.Description;
import org.hamcrest.TypeSafeMatcher;

import com.salesforce.messaging.EventKey;
import com.salesforce.messaging.MessagePassableException;

/**
 * Custom matcher that can be used with
 * {@link org.junit.rules.ExpectedException#expect(org.hamcrest.Matcher)}
 *
 * <pre>
 * // Example Usage
 * thrown.expect(new MessagePassableExceptionMatcher(EventKey.WARNING_INVALID_CAT_SKIPPED,
 * 		new String[] { "InventoryName" }));
 * </pre>
 */
public class MessagePassableExceptionMatcher extends TypeSafeMatcher<MessagePassableException> {
	private final EventKey expectedEventKey;
	private final String[] expectedArgs;

	public MessagePassableExceptionMatcher(EventKey expectedEventKey, String[] expectedArgs) {
		this.expectedEventKey = expectedEventKey;
		this.expectedArgs = nullToEmpty(expectedArgs);
	}

	@Override
	protected boolean matchesSafely(MessagePassableException item) {
		String[] actualArgs = nullToEmpty(item.getArgs());
		return expectedEventKey.equals(item.getEventKey()) &&
			Arrays.equals(expectedArgs, actualArgs);
	}

	@Override
	public void describeTo(Description description) {
		description.appendText("EventKey=").appendValue(expectedEventKey.name()).appendText(", Args=")
			.appendValue(expectedArgs);
	}

	/**
	 * Convert a null array to empty array. The are equivalent for our purposes.
	 */
	private String[] nullToEmpty(String[] array) {
		return Optional.ofNullable(array).orElseGet(() -> new String[] {});
	}
}
