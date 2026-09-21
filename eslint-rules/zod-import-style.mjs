/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Zod is imported one way: `import * as z from "zod";`. It is what Zod 4's own docs use, it keeps
// every `z.` reference (including types such as `z.ZodError`) reachable from the one namespace,
// and it stops the codebase drifting between `{ z }`, default, subpath and named imports.
//
// `import { z } from "zod"` is fixable; named imports (`{ ZodError }`) and subpaths (`zod/v4`,
// `zod/mini`) are not, since the right replacement depends on how they are used.

const MESSAGE = 'Import Zod as `import * as z from "zod";`.';

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    docs: { description: 'Import Zod only as `import * as z from "zod"`' },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (source !== "zod" && !source.startsWith("zod/")) return;

        const [only] = node.specifiers;
        const isCanonical =
          source === "zod" &&
          node.specifiers.length === 1 &&
          only.type === "ImportNamespaceSpecifier" &&
          only.local.name === "z" &&
          node.importKind !== "type";
        if (isCanonical) return;

        // `import { z } from "zod"` — the one shape with an unambiguous rewrite.
        const isBraceZ =
          source === "zod" &&
          node.specifiers.length === 1 &&
          only.type === "ImportSpecifier" &&
          only.imported.type === "Identifier" &&
          only.imported.name === "z" &&
          only.local.name === "z" &&
          node.importKind !== "type";

        context.report({
          node,
          message: MESSAGE,
          fix: isBraceZ ? (fixer) => fixer.replaceText(node, 'import * as z from "zod";') : null,
        });
      },
    };
  },
};

export default rule;
