/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

import noDeepRelativeImports from "./eslint-rules/no-deep-relative-imports.mjs";
import nzSpelling from "./eslint-rules/nz-spelling.mjs";

// One shared plugin object: flat config rejects redefining a plugin name with a different object
// when two blocks match the same file.
const avut = {
  rules: { "nz-spelling": nzSpelling, "no-deep-relative-imports": noDeepRelativeImports },
};

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "next-env.d.ts", "src/generated/**", ".claude/worktrees/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Keep relative imports to one `../` at most — anything further uses the `@/` alias.
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: [".content-collections/**"], // generated
    plugins: { avut },
    rules: {
      "avut/no-deep-relative-imports": "error",
    },
  },
  {
    // Pages and components must go through the session helpers rather than reaching for
    // `auth.api` directly — that is how pages ended up unguarded, and how the two i3 pages
    // ended up with `session!` non-null assertions.
    //
    // Restricting only the `auth` binding keeps `import type { AuthSession }` working.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/trpc/**", "src/app/(public)/auth/**", "src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/auth",
              importNames: ["auth"],
              message:
                "Use requireSession() from @/server/session or requireOrganization() from @/server/organization-access instead of calling auth.api directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // Better Auth's own `useSession` keeps a nanostore cache with no relationship to React
    // Query: a second copy of the session that goes stale independently, cannot be hydrated
    // from the server, and survives sign-out.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='authClient'][property.name='useSession']",
          message:
            "Use useSession() from @/client/auth-queries instead of authClient.useSession().",
        },
      ],
    },
  },
  {
    // en-NZ copy sweep guardrail (https://github.com/redcloud-nz/avut/issues/197). The sweep is
    // clean as of the commit that flipped this to `error` — a regression should fail CI, not
    // just warn. Scoped to rendered JSX text and a handful of text-bearing attributes — never
    // code identifiers or class names — so it can safely cover all app/component/email source.
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx", "src/emails/**/*.tsx"],
    plugins: { avut },
    rules: {
      "avut/nz-spelling": "error",
    },
  },
  {
    // Centralised label/description files — small and fully user-facing, so every string
    // literal (not just JSX text) is worth checking here.
    files: [
      "src/lib/modules.ts",
      "src/lib/permissions.ts",
      "src/lib/schemas/organization-role.ts",
      "src/lib/glossary.ts",
    ],
    plugins: { avut },
    rules: {
      "avut/nz-spelling": ["error", { checkLabelProperties: true }],
    },
  },
];

export default config;
