/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";

import noDeepRelativeImports from "./eslint-rules/no-deep-relative-imports.mjs";
import noTrpcClientInServerComponent from "./eslint-rules/no-trpc-client-in-server-component.mjs";
import nzSpelling from "./eslint-rules/nz-spelling.mjs";
import requireServerOnly from "./eslint-rules/require-server-only.mjs";

// One shared plugin object: flat config rejects redefining a plugin name with a different object
// when two blocks match the same file.
const avut = {
  rules: {
    "nz-spelling": nzSpelling,
    "no-deep-relative-imports": noDeepRelativeImports,
    "no-trpc-client-in-server-component": noTrpcClientInServerComponent,
    "require-server-only": requireServerOnly,
  },
};

const resendRestriction = {
  name: "resend",
  message: "Send mail through sendEmail() in @/server/email — it is the outbound-email guard rail.",
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
    // Layering. `src/lib` is the leaf: everything may depend on it, it depends on nothing above
    // it. The server never reaches back up into UI code, and the client-side layers (`client`,
    // `hooks`) only see server code as types — a value import would pull it into the browser
    // bundle. `server-only` catches that too, but only for modules that carry the marker.
    //
    // `components` is deliberately not restricted from `@/server`: it mixes client components
    // with server components (`cards/`, `nav/public-header`) that legitimately call the session
    // helpers.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/generated/**"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "generated", pattern: "src/generated/**", partialMatch: false },
        { type: "lib", pattern: "src/lib/**", partialMatch: false },
        { type: "server", pattern: "src/server/**", partialMatch: false },
        { type: "trpc", pattern: "src/trpc/**", partialMatch: false },
        { type: "forms", pattern: "src/forms/**", partialMatch: false },
        { type: "emails", pattern: "src/emails/**", partialMatch: false },
        { type: "client", pattern: "src/client/**", partialMatch: false },
        { type: "hooks", pattern: "src/hooks/**", partialMatch: false },
        { type: "components", pattern: "src/components/**", partialMatch: false },
        { type: "app", pattern: "src/app/**", partialMatch: false },
      ],
      "boundaries/files": [
        { category: "test", pattern: "**/*.test.{ts,tsx}", partialMatch: false },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { element: { type: "lib" } },
              disallow: {
                to: {
                  element: {
                    types: [
                      "server",
                      "trpc",
                      "forms",
                      "emails",
                      "client",
                      "hooks",
                      "components",
                      "app",
                    ],
                  },
                },
              },
              message: "src/lib is the leaf layer and must not import from {{ to.element.type }}.",
            },
            {
              from: { element: { types: ["server", "trpc", "forms", "emails"] } },
              disallow: { to: { element: { types: ["client", "hooks", "components", "app"] } } },
              message: "Server-side code must not import UI code ({{ to.element.type }}).",
            },
            {
              from: { element: { types: ["client", "hooks"] } },
              disallow: { to: { element: { types: ["server", "forms"] } } },
              message:
                "Client-side code may only `import type` from {{ to.element.type }}; a value import pulls it into the browser bundle.",
            },
            {
              from: { element: { types: ["client", "hooks"] } },
              allow: {
                to: { element: { types: ["server", "forms"] } },
                dependency: { kind: "type" },
              },
            },
          ],
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
    // sendEmail() in src/server/email.ts is the only place allowed to talk to Resend; calling the
    // client directly skips the redirect-to-sink guard rail. The block below re-lists this
    // restriction because flat config replaces `no-restricted-imports` options per file rather
    // than merging them.
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/server/email.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [resendRestriction] }],
    },
  },
  {
    // Every server module carries the `server-only` marker, so a client component that reaches one
    // fails the build. Exempt: tests (Vitest mocks the marker anyway), `.d.ts` files, and
    // `prisma.ts`, which `prisma/seed-demo.ts` imports from `tsx` outside Next, where the marker
    // would throw.
    files: ["src/server/**/*.{ts,tsx}"],
    ignores: ["src/server/**/*.test.{ts,tsx}", "src/server/**/*.d.ts", "src/server/prisma.ts"],
    plugins: { avut },
    rules: {
      "avut/require-server-only": "error",
    },
  },
  {
    // Entry files are Server Components unless they say "use client".
    files: ["src/app/**/{page,layout,template,default,not-found}.tsx", "src/app/**/route.ts"],
    plugins: { avut },
    rules: {
      "avut/no-trpc-client-in-server-component": "error",
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
            resendRestriction,
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
