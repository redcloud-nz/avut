/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Allows at most one `../` in a relative import specifier. Anything further up the tree should
// use the `@/` alias (which maps to `src/`) so the import doesn't change meaning when a file
// moves and reads the same wherever it is used.
//
// A dedicated rule rather than `no-restricted-imports` because flat config replaces a rule's
// options wholesale when two blocks match the same file — a `patterns` entry here would silently
// cancel the `auth` restriction in eslint.config.mjs (or vice versa).

const MESSAGE =
  "Import from '@/…' instead of climbing more than one directory with '../'. " +
  "(Files outside src/, such as package.json, can't use the alias — disable this rule on that line with a reason.)";

/** @param {string} specifier */
function climbsTooFar(specifier) {
  if (!specifier.startsWith(".")) return false;
  return specifier.split("/").filter((segment) => segment === "..").length > 1;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    schema: [],
    docs: { description: "Disallow relative imports that climb more than one directory" },
  },
  create(context) {
    /** @param {import("estree").Node} node @param {import("estree").Node | null | undefined} source */
    function check(node, source) {
      if (source?.type !== "Literal" || typeof source.value !== "string") return;
      if (climbsTooFar(source.value)) context.report({ node: source, message: MESSAGE });
    }

    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
    };
  },
};

export default rule;
