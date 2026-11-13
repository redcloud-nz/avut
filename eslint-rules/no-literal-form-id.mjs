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
// A label's `htmlFor` and the `aria-*` id references resolve the same way, so a fixed field id
// lets a label focus or toggle the hidden copy's control
// (https://github.com/redcloud-nz/avut/issues/476).
//
// Give each instance its own id with `const formId = useId()` and pass `form={formId}`; derive
// field ids from it (`${formId}-name`). The check is syntactic: it flags one of these attributes
// whose value is a string literal.

const FORM_MESSAGE =
  'A fixed `form="…"` id can resolve to a hidden copy of the same form on a page Next keeps ' +
  "mounted. Use `const formId = useId()` with `id={formId}` / `form={formId}`.";

const FIELD_MESSAGE =
  "A fixed `{{name}}` id can resolve to a hidden copy of the same field on a page Next keeps " +
  "mounted. Derive the id from `useId()`, e.g. `${formId}-name`.";

const ID_REFERENCES = new Set(["htmlFor", "aria-describedby", "aria-labelledby", "aria-controls"]);

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
    docs: {
      description: "Point at a form or field with a useId()-derived id, not a literal",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const name = node.name.name;
        if (!isStringLiteral(node.value)) return;
        if (name === "form") context.report({ node, message: FORM_MESSAGE });
        else if (ID_REFERENCES.has(name))
          context.report({ node, message: FIELD_MESSAGE, data: { name } });
      },
    };
  },
};

export default rule;
