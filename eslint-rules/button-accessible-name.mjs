/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Every `<Button>` needs a name a screen reader can announce. Two ways of losing it:
//
// - An icon-size Button (`size="icon"`, `"icon-sm"`, …) whose only child is an SVG is announced
//   as just "button". Give it an `aria-label` (or an `sr-only` span).
// - A label span hidden below a breakpoint (`hidden md:inline`) takes the name with it on small
//   screens. Keep it in the accessibility tree with `sr-only md:not-sr-only` instead.
//
// The check is syntactic. A Button with a spread (`{...props}`) may get its name from the caller
// and is skipped; any text, or any expression that could be text (`{label}`), counts as a name.

const ICON_MESSAGE =
  'Icon-only <Button size="icon…"> has no accessible name. Add an aria-label (or an sr-only span).';
const HIDDEN_MESSAGE =
  "This label is removed from the accessibility tree below the breakpoint, so the button loses " +
  "its name there. Use `sr-only <bp>:not-sr-only` instead of `hidden <bp>:inline`.";

const RESPONSIVE_SHOW = /^(sm|md|lg|xl|2xl):(inline|inline-block|block|flex|inline-flex)$/;

function attribute(opening, name) {
  return opening.attributes.find(
    (attr) =>
      attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === name,
  );
}

function elementName(opening) {
  return opening.name.type === "JSXIdentifier" ? opening.name.name : null;
}

/** String literals in an attribute value — enough to see `className="…"` and `cn("…", …)`. */
function stringsIn(node) {
  if (!node) return [];
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [node.value] : [];
    case "TemplateLiteral":
      return node.quasis.map((quasi) => quasi.value.cooked ?? "");
    case "JSXExpressionContainer":
      return stringsIn(node.expression);
    case "CallExpression":
      return node.arguments.flatMap(stringsIn);
    case "ConditionalExpression":
      return [...stringsIn(node.consequent), ...stringsIn(node.alternate)];
    case "LogicalExpression":
      return stringsIn(node.right);
    default:
      return [];
  }
}

function classTokens(opening) {
  return stringsIn(attribute(opening, "className")?.value).flatMap((value) => value.split(/\s+/));
}

/** Whether a JSX child (or expression) contributes text to the accessible name. */
function hasName(node) {
  switch (node.type) {
    case "JSXText":
      return node.value.trim() !== "";
    case "JSXExpressionContainer":
      return node.expression.type !== "JSXEmptyExpression" && hasName(node.expression);
    case "JSXElement": {
      const opening = node.openingElement;
      if (attribute(opening, "aria-hidden")) return false;
      if (attribute(opening, "aria-label") || attribute(opening, "aria-labelledby")) return true;
      return node.children.some(hasName);
    }
    case "JSXFragment":
      return node.children.some(hasName);
    case "Literal":
      return typeof node.value === "string" ? node.value.trim() !== "" : node.value != null;
    case "ConditionalExpression":
      return hasName(node.consequent) || hasName(node.alternate);
    case "LogicalExpression":
      return hasName(node.right);
    case "Identifier":
      return node.name !== "undefined";
    case "TemplateLiteral":
    case "MemberExpression":
    case "CallExpression":
    case "ChainExpression":
      return true;
    default:
      return false;
  }
}

/** Descendant elements hidden below a breakpoint with `hidden <bp>:inline` and the like. */
function responsivelyHidden(node, found = []) {
  for (const child of node.children ?? []) {
    if (child.type === "JSXElement") {
      const tokens = classTokens(child.openingElement);
      if (tokens.includes("hidden") && tokens.some((token) => RESPONSIVE_SHOW.test(token))) {
        found.push(child);
      }
      responsivelyHidden(child, found);
    } else if (child.type === "JSXFragment") {
      responsivelyHidden(child, found);
    }
  }
  return found;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    docs: { description: "Give every <Button> an accessible name at every breakpoint" },
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (elementName(opening) !== "Button") return;

        for (const hidden of responsivelyHidden(node)) {
          context.report({ node: hidden.openingElement, message: HIDDEN_MESSAGE });
        }

        const size = stringsIn(attribute(opening, "size")?.value);
        if (!size.some((value) => value.startsWith("icon"))) return;
        if (opening.attributes.some((attr) => attr.type === "JSXSpreadAttribute")) return;
        if (attribute(opening, "aria-label") || attribute(opening, "aria-labelledby")) return;
        if (attribute(opening, "title")) return;
        if (node.children.some(hasName)) return;

        context.report({ node: opening, message: ICON_MESSAGE });
      },
    };
  },
};

export default rule;
