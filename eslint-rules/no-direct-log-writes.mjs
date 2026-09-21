/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Audit-log rows are written in one place: `recordLogEntry` / `recordLogBatch` in
// src/server/log-entry.ts, reached through `ctx.logEvent`. That is where the write-time
// invariants and the closed vocabularies are enforced, so a hand-written `logEntry.create`
// silently skips them. The log is append-only, so updates and deletes are out too.
//
// Matches `<anything>.logEntry.create(...)` (and the other write methods) on the three log
// models, whatever the client is called — `prisma`, `tx`, `ctx.prisma`.

const MODELS = new Set(["logEntry", "logEntryObject", "logBatch"]);
const WRITES = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

/** @param {import("estree").Node} node */
function propertyName(node) {
  if (node.type !== "MemberExpression") return null;
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  if (node.computed && node.property.type === "Literal") return String(node.property.value);
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Log entries are written only through ctx.logEvent" },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        const method = propertyName(callee);
        if (!method || !WRITES.has(method)) return;

        const model = propertyName(callee.object);
        if (!model || !MODELS.has(model)) return;

        context.report({
          node: callee,
          message:
            `Don't write \`${model}.${method}\` by hand. Audit-log rows go through ` +
            "`ctx.logEvent(...)`, which delegates to recordLogEntry in src/server/log-entry.ts.",
        });
      },
    };
  },
};

export default rule;
