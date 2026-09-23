/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";

import idsViaSchemas from "./eslint-rules/ids-via-schemas.mjs";
import noDeepRelativeImports from "./eslint-rules/no-deep-relative-imports.mjs";
import noDeprecatedZod from "./eslint-rules/no-deprecated-zod.mjs";
import noDirectLogWrites from "./eslint-rules/no-direct-log-writes.mjs";
import noPrismaModelImports from "./eslint-rules/no-prisma-model-imports.mjs";
import noProcessEnv from "./eslint-rules/no-process-env.mjs";
import noTrpcClientInServerComponent from "./eslint-rules/no-trpc-client-in-server-component.mjs";
import nzSpelling from "./eslint-rules/nz-spelling.mjs";
import requireServerOnly from "./eslint-rules/require-server-only.mjs";
import zodImportStyle from "./eslint-rules/zod-import-style.mjs";

// One shared plugin object: flat config rejects redefining a plugin name with a different object
// when two blocks match the same file.
const avut = {
  rules: {
    "nz-spelling": nzSpelling,
    "ids-via-schemas": idsViaSchemas,
    "no-deep-relative-imports": noDeepRelativeImports,
    "no-deprecated-zod": noDeprecatedZod,
    "no-direct-log-writes": noDirectLogWrites,
    "no-prisma-model-imports": noPrismaModelImports,
    "no-process-env": noProcessEnv,
    "no-trpc-client-in-server-component": noTrpcClientInServerComponent,
    "require-server-only": requireServerOnly,
    "zod-import-style": zodImportStyle,
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
    // Only `src/server` and the tRPC context (`src/trpc/init.ts`) may import the Prisma client
    // singleton. Everything else reaches the database through a `src/server` function or, inside a
    // procedure, `ctx.prisma` — so reads and writes go through the same permission and audit
    // paths instead of a page or route handler querying directly.
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
      // Element patterns match folders; single files are classified here instead.
      "boundaries/files": [
        { category: "test", pattern: "**/*.test.{ts,tsx}", partialMatch: false },
        { category: "prisma-client", pattern: "src/server/prisma.ts", partialMatch: false },
        { category: "trpc-context", pattern: "src/trpc/init.ts", partialMatch: false },
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
              from: {
                element: {
                  types: ["server", "trpc", "forms", "emails"],
                },
              },
              disallow: { to: { element: { types: ["client", "hooks", "components", "app"] } } },
              message: "Server-side code must not import UI code ({{ to.element.type }}).",
            },
            {
              from: { element: { types: ["client", "hooks"] } },
              disallow: {
                to: { element: { types: ["server", "forms"] } },
              },
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
            {
              from: {
                element: {
                  types: ["lib", "trpc", "forms", "emails", "client", "hooks", "components", "app"],
                },
              },
              disallow: { to: { file: { categories: "prisma-client" } } },
              message:
                "Don't import the Prisma client here. Use a function from src/server, or ctx.prisma inside a tRPC procedure.",
            },
            {
              from: {
                element: { types: ["client", "hooks", "components", "app", "emails", "forms"] },
              },
              disallow: { to: { element: { type: "generated" } } },
              message:
                "UI code doesn't import the generated Prisma client; take record types from src/lib/schemas.",
            },
            {
              from: { file: { categories: "trpc-context" } },
              allow: { to: { file: { categories: "prisma-client" } } },
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
    // The generated Prisma client is imported for its model types only in `src/lib/schemas`, each
    // under a `<Name>Record` alias and re-exported from there, so `Skill` (the domain type) and
    // `Skill` (the Prisma model) never meet in one file. Elsewhere only the client machinery may
    // come from the generated package.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/schemas/**", "src/generated/**"],
    plugins: { avut },
    rules: {
      "avut/no-prisma-model-imports": ["error", { allow: ["Prisma", "PrismaClient"] }],
    },
  },
  {
    // Environment variables are read in `@/lib/env` and `@/server/env`, and imported from there.
    // Tests set `process.env` per case.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/env.ts",
      "src/server/env.ts",
      "src/generated/**",
      "src/test/**",
      "**/*.test.{ts,tsx}",
    ],
    plugins: { avut },
    rules: {
      "avut/no-process-env": "error",
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
    // Audit-log rows are written only by recordLogEntry, reached through ctx.logEvent.
    files: ["{src,prisma}/**/*.{ts,tsx}"],
    ignores: ["src/server/log-entry.ts", "**/*.test.{ts,tsx}", "src/test/**"],
    plugins: { avut },
    rules: {
      "avut/no-direct-log-writes": "error",
    },
  },
  {
    // Record IDs come from `<Model>Id.create()` in the schema files. Tests build fixtures with
    // whatever ID they like.
    files: ["{src,prisma}/**/*.{ts,tsx}"],
    ignores: ["src/lib/schemas/**", "src/lib/id.ts", "**/*.test.{ts,tsx}", "src/test/**"],
    plugins: { avut },
    rules: {
      "avut/ids-via-schemas": "error",
    },
  },
  {
    // One way to import Zod, and no Zod 3 style string formats.
    files: ["**/*.{ts,tsx}"],
    plugins: { avut },
    rules: {
      "avut/zod-import-style": "error",
      "avut/no-deprecated-zod": "error",
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
