/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Record IDs are created by the model's schema file: `<Model>Id.create()`. That keeps the ID
// format, and the brand that stops one model's ID being passed as another's, in one place per
// model — instead of every call site reaching for `nanoId16()` and hoping it is the right kind
// of string.
//
// eslint.config.mjs exempts `src/lib/schemas/` (where the `create()` functions live),
// `src/lib/id.ts` and tests. Anything else that genuinely needs a raw ID — better-auth's
// `generateId` hook, which serves every auth model — disables the rule with a reason.

const MESSAGE =
  "Create IDs with `<Model>Id.create()` from the model's schema file in @/lib/schemas " +
  "(add an Id to the schema if the model doesn't have one yet).";

const ID_PACKAGES = new Set(["nanoid", "uuid"]);
const CRYPTO_MODULES = new Set(["crypto", "node:crypto"]);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Record IDs are created through the schema file's Id.create()" },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;

        if (ID_PACKAGES.has(source)) {
          context.report({ node: node.source, message: MESSAGE });
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const name =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : String(specifier.imported.value);

          const isNanoId = source === "@/lib/id" && name === "nanoId16";
          const isRandomUUID = CRYPTO_MODULES.has(source) && name === "randomUUID";
          if (isNanoId || isRandomUUID) context.report({ node: specifier, message: MESSAGE });
        }
      },
      // `crypto.randomUUID()`
      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier") return;
        if (node.property.name === "randomUUID") context.report({ node, message: MESSAGE });
      },
    };
  },
};

export default rule;
