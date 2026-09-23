/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Requires `import "server-only";` in every module the config applies this to (src/server/).
//
// The marker is what turns "a client component reached a server module" from a silent bundling
// problem into a build error. It only protects the modules that carry it, so a server module
// without it is a hole in that guarantee.

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: 'Require `import "server-only"` in server modules' },
  },
  create(context) {
    return {
      Program(node) {
        const hasMarker = node.body.some(
          (statement) =>
            statement.type === "ImportDeclaration" &&
            statement.source.value === "server-only" &&
            statement.specifiers.length === 0,
        );
        if (hasMarker) return;
        context.report({
          node,
          loc: { line: 1, column: 0 },
          message:
            'Server modules must start with `import "server-only";` so importing them from a client component fails the build.',
        });
      },
    };
  },
};

export default rule;
