import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        deps: {
            // We turn this off so that vitest catches "default imports" vs "namespace imports" issues
            // instead of treating both types of imports as the same.
            interopDefault: false
        },
        setupFiles: ["test/setup-tests.ts"],
        testTimeout: 60000,
        environment: "node",
        include: ["test/**/*.test.ts"],
        globals: true,
        clearMocks: true,
        coverage: {
            provider: "istanbul",
            reporter: ["text", "json", "html", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts", "src/lib/Display.ts"],
            thresholds: {
				"lines": 90,
				"functions": 90,
				"branches": 90,
				"statements": 90
            }
        }
    }
})