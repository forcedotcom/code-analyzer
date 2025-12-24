// Note that in a single process our tests create many instances of CodeAnalyzer. For each instance of CodeAnalyzer, a
// call to process.addListener is made to cleanup the root working folder if needed. See
//    https://github.com/forcedotcom/code-analyzer-core/blob/dev/packages/code-analyzer-core/src/code-analyzer.ts#L121
// Because of this we would get a lot of warnings. For example:
//    (node:2039) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 exit listeners added to [process].
// To suppress these warnings, it is easiest to just allow the process running these tests to allow an infinite amount
// of listeners. So we do that here (where 0 means infinite):
process.setMaxListeners(0);

// Some dependencies (Ink via @oclif/table) patch the console and expect `console.Console` to exist.
// In the Vitest environment, the global console can be a proxied object without a `Console` constructor.
// Ensure `console.Console` points to Node's Console to avoid "console.Console is not a constructor" errors.
import { Console as NodeConsole } from 'node:console';
(globalThis.console as unknown as { Console?: typeof NodeConsole }).Console ??= NodeConsole;