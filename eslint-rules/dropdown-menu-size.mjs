/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// `DropdownMenuContent` takes its width from a `size` prop (sm / md / lg / trigger), so menus of
// the same kind are the same width across the app. A width utility in its `className` picks a
// one-off width again (https://github.com/redcloud-nz/avut/issues/467).
//
// The check is syntactic: it looks at string literals in the `className` attribute, including
// those inside a `cn(…)` call or a conditional, and flags `w-*`, `min-w-*`, `max-w-*` and
// `size-*` utilities under any variant prefix.

const MESSAGE =
  'Set a dropdown menu\'s width with `size="sm" | "md" | "lg" | "trigger"`, not a width class.';

const WIDTH_UTILITY = /^!?-?(?:min-w|max-w|w|size)-/;

/** A class token's variant prefixes (`sm:`, `data-[x=y]:`) and its utility. */
function splitToken(token) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === ":" && depth === 0) start = i + 1;
  }
  return { variants: token.slice(0, start), utility: token.slice(start) };
}

// A variant that targets descendants (`*:`, `**:`, `[&_svg]:`) sizes the items, not the menu.
const CHILD_VARIANT = /(?:^|:)(?:\*{1,2}|\[&[^\]]*\]):/;

function hasWidthClass(value) {
  return value.split(/\s+/).some((token) => {
    const { variants, utility } = splitToken(token);
    return WIDTH_UTILITY.test(utility) && !CHILD_VARIANT.test(variants);
  });
}

/** Whether any string literal reachable from this class expression carries a width utility. */
function containsWidthClass(node) {
  if (!node) return false;
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && hasWidthClass(node.value);
    case "TemplateLiteral":
      return (
        node.quasis.some((q) => hasWidthClass(q.value.cooked ?? "")) ||
        node.expressions.some(containsWidthClass)
      );
    case "JSXExpressionContainer":
      return containsWidthClass(node.expression);
    case "CallExpression":
      return node.arguments.some(containsWidthClass);
    case "ConditionalExpression":
      return containsWidthClass(node.consequent) || containsWidthClass(node.alternate);
    case "LogicalExpression":
      return containsWidthClass(node.left) || containsWidthClass(node.right);
    case "ArrayExpression":
      return node.elements.some(containsWidthClass);
    default:
      return false;
  }
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Size a DropdownMenuContent with its size prop, not width classes" },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "className") return;
        const element = node.parent.name;
        if (element.type !== "JSXIdentifier" || element.name !== "DropdownMenuContent") return;
        if (containsWidthClass(node.value)) context.report({ node, message: MESSAGE });
      },
    };
  },
};

export default rule;
