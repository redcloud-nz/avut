/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "next-env.d.ts", "src/generated/**"],
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
    // Pages and components must go through the session helpers rather than reaching for
    // `auth.api` directly — that is how pages ended up unguarded, and how the two i3 pages
    // ended up with `session!` non-null assertions.
    //
    // Restricting only the `auth` binding keeps `import type { AuthSession }` working.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/trpc/**", "src/app/auth/**", "src/app/api/**"],
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
];

export default config;
