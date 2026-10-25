/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// A submit button outside its `<form>` (a dialog footer) points at the form with `form="…"`, and
// the browser resolves that to the first element in the document with the id. With
// `cacheComponents`, Next keeps visited routes mounted in a hidden `<Activity>`, so an earlier
// page's copy of the same dialog can still be in the DOM and come first: the visible button then
// submits the hidden form, with that instance's props and stale field values
// (https://github.com/redcloud-nz/avut/issues/465).
//
// Give each instance its own id with `const formId = useId()` and pass `form={formId}`. The check
// is syntactic: it flags a `form` attribute whose value is a string literal.

const MESSAGE =
  'A fixed `form="…"` id can resolve to a hidden copy of the same form on a page Next keeps ' +
  "mounted. Use `const formId = useId()` with `id={formId}` / `form={formId}`.";

function isStringLiteral(node) {
  if (!node) return false;
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string";
    case "TemplateLiteral":
      return node.expressions.length === 0;
    case "JSXExpressionContainer":
      return isStringLiteral(node.expression);
    default:
      return false;
  }
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Point a submit button at its form with a useId() id, not a literal" },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "form") return;
        if (isStringLiteral(node.value)) context.report({ node, message: MESSAGE });
      },
    };
  },
};

export default rule;
