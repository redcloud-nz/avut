import { resolve } from "path";
import { defineConfig } from "vitest/config";

import react from "@vitejs/plugin-react";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["**/*.{test,spec}.{ts,tsx}"],
        // `.claude/worktrees` holds git worktrees of this same repo, so the include glob
        // would otherwise collect a second copy of every test — which then fails on a
        // missing node_modules rather than for any real reason.
        exclude: ["node_modules", ".next", "dist", ".claude/worktrees"],
        env: {
            NODE_ENV: "test",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                ".next/",
                "dist/",
                "**/*.d.ts",
                "**/*.config.{js,ts}",
                "**/coverage/**",
                "src/test/**",
            ],
        },
    },
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            // The real package throws outside Next's `react-server` condition, so every server
            // module would be unimportable from a test.
            "server-only": resolve(__dirname, "./src/test/server-only.ts"),
            "content-collections": resolve(__dirname, "./.content-collections/generated"),
        },
    },
    define: {
        "process.env.NODE_ENV": '"test"',
    },
});
