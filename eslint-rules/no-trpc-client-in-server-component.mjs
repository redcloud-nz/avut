/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// A Server Component must use `trpc` from `@/trpc/server`, which calls the router in-process and
// keeps the request's session. `@/trpc/client` goes out over HTTP, so its `queryFn` arrives
// unauthenticated when run on the server.
//
// Whether a file is a Server Component is decided by the `"use client"` directive, which is
// syntax rather than path, so this can't be a `no-restricted-imports` block. The rule is scoped
// by eslint.config.mjs to Next's entry files (page, layout, route, …) — the only files that are
// always Server Components unless they say otherwise. Any other file may be imported from either
// side, so its directive says nothing about where it runs.

const MESSAGE =
  "This file is a Server Component (no 'use client'). Use `trpc` from '@/trpc/server' — " +
  "'@/trpc/client' goes over HTTP and its queryFn arrives unauthenticated.";

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Disallow @/trpc/client in files that are Server Components" },
  },
  create(context) {
    let isClientFile = false;

    return {
      Program(node) {
        isClientFile = node.body.some(
          (statement) =>
            statement.type === "ExpressionStatement" && statement.directive === "use client",
        );
      },
      ImportDeclaration(node) {
        if (isClientFile) return;
        if (node.source.value !== "@/trpc/client") return;
        if (node.importKind === "type") return;
        context.report({ node: node.source, message: MESSAGE });
      },
    };
  },
};

export default rule;
