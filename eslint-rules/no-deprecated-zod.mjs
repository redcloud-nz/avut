/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Zod 4 moved the string-format checks off `z.string()` and deprecated the old chained forms.
// `z.string().email()` still works, which is exactly why it drifts back in; the top-level
// replacements are stricter, tree-shake better, and are what the Zod 4 docs show.

/** Deprecated `z.string().<method>()` → what to write instead. */
const REPLACEMENTS = {
  email: "z.email()",
  uuid: "z.uuid()",
  url: "z.url()",
  emoji: "z.emoji()",
  nanoid: "z.nanoid()",
  cuid: "z.cuid()",
  cuid2: "z.cuid2()",
  ulid: "z.ulid()",
  base64: "z.base64()",
  base64url: "z.base64url()",
  jwt: "z.jwt()",
  e164: "z.e164()",
  ip: "z.ipv4() or z.ipv6()",
  cidr: "z.cidrv4() or z.cidrv6()",
  date: "z.iso.date()",
  time: "z.iso.time()",
  datetime: "z.iso.datetime()",
  duration: "z.iso.duration()",
};

/** Is `node` a `z.string(...)` call? */
function isZString(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "z" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "string"
  );
}

/** Walks `z.string().trim().min(1).<here>` back to see whether it started at `z.string()`. */
function startsAtZString(node) {
  let current = node;
  while (current) {
    if (isZString(current)) return true;
    if (current.type === "CallExpression") current = current.callee;
    else if (current.type === "MemberExpression") current = current.object;
    else return false;
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    schema: [],
    docs: { description: "Disallow Zod 3 style string-format checks" },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier") return;

        const method = callee.property.name;
        if (!Object.hasOwn(REPLACEMENTS, method)) return;
        if (!startsAtZString(callee.object)) return;

        context.report({
          node: callee.property,
          message: `\`z.string().${method}()\` is deprecated in Zod 4. Use \`${REPLACEMENTS[method]}\`.`,
        });
      },
    };
  },
};

export default rule;
