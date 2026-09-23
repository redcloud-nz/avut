/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// `process.env` is read in two modules — `@/lib/env` (safe in any bundle) and `@/server/env`
// (secrets and server-only settings) — and everything else imports from them. That keeps the set
// of environment variables the app depends on in one reviewable place, and gives each a type and
// a description instead of an ad hoc `as string`.
//
// eslint.config.mjs exempts those two modules and tests, which set `process.env` per case.
// Files outside `src/` (next.config.ts, the seed, scripts) run before or outside the app and
// aren't covered.

const MESSAGE =
  "Read environment variables through `env` from '@/lib/env', or `serverEnv` from '@/server/env' " +
  "for secrets and server-only settings. Add the variable there if it isn't listed.";

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Read process.env only in the env modules" },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.type !== "Identifier" || node.object.name !== "process") return;
        const isEnv = node.computed
          ? node.property.type === "Literal" && node.property.value === "env"
          : node.property.type === "Identifier" && node.property.name === "env";
        if (isEnv) context.report({ node, message: MESSAGE });
      },
    };
  },
};

export default rule;
