/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Flags American spellings in user-visible copy so the en-NZ sweep (https://github.com/redcloud-nz/avut/issues/197)
// can be tracked to zero and PRs can't reintroduce it afterwards.
//
// Deliberately narrow: it only inspects JSXText, a small allowlist of text-bearing JSX
// attributes, and (with `checkAllStringLiterals`) every string literal in a file — the latter
// is only ever enabled for small, centralised label/description files via eslint.config.mjs, not
// for general application code. It never looks at identifiers, import paths, className/style
// values, or object keys, so code that legitimately says `organization` (the better-auth plugin,
// Prisma models, `organizationProcedure`, `/orgs/` routes, …) is untouched.

/** Words where the American form is a plain substring swap of the whole word. */
const WORD_PAIRS = [
  ["color", "colour"],
  ["colors", "colours"],
  ["colored", "coloured"],
  ["coloring", "colouring"],
  ["favorite", "favourite"],
  ["favorites", "favourites"],
  ["behavior", "behaviour"],
  ["behaviors", "behaviours"],
  ["behavioral", "behavioural"],
  ["center", "centre"],
  ["centers", "centres"],
  ["centered", "centred"],
  ["centering", "centring"],
  ["neighbor", "neighbour"],
  ["neighbors", "neighbours"],
  ["neighborhood", "neighbourhood"],
  ["neighborhoods", "neighbourhoods"],
  ["labor", "labour"],
  ["honor", "honour"],
  ["honors", "honours"],
  ["rumor", "rumour"],
  ["rumors", "rumours"],
  ["humor", "humour"],
  ["flavor", "flavour"],
  ["flavors", "flavours"],
  ["vapor", "vapour"],
  ["endeavor", "endeavour"],
  ["endeavors", "endeavours"],
  ["gray", "grey"],
  ["catalog", "catalogue"],
  ["catalogs", "catalogues"],
  ["dialog", "dialogue"],
  ["dialogs", "dialogues"],
  ["defense", "defence"],
  ["offense", "offence"],
  ["fiber", "fibre"],
  ["fibers", "fibres"],
  ["theater", "theatre"],
  ["theaters", "theatres"],
  ["enrollment", "enrolment"],
  ["enrollments", "enrolments"],
  ["enroll", "enrol"],
  ["enrolls", "enrols"],
  ["enrolled", "enrolled"],
  ["fulfill", "fulfil"],
  ["fulfills", "fulfils"],
  ["fulfillment", "fulfilment"],
  ["skillful", "skilful"],
  ["skillfully", "skilfully"],
  // "practice" the noun is spelled the same in NZ and US English; only the verb differs
  // ("practise"). "practiced"/"practicing" are unambiguously verb forms, so — unlike the bare
  // word "practice" — they always need converting. See AMBIGUOUS_WORDS below for the noun/verb
  // pair itself.
  ["practiced", "practised"],
  ["practicing", "practising"],
  // Single-vowel + "l" verbs that double the "l" before a vowel suffix in NZ English but not
  // in American English. Enumerated (not a general regex) — the doubling rule has enough
  // exceptions (e.g. "reveal", "appeal") that a blanket pattern produces false positives.
  ["canceled", "cancelled"],
  ["canceling", "cancelling"],
  ["canceler", "canceller"],
  ["cancelers", "cancellers"],
  ["traveled", "travelled"],
  ["traveling", "travelling"],
  ["traveler", "traveller"],
  ["travelers", "travellers"],
  ["modeled", "modelled"],
  ["modeling", "modelling"],
  ["modeler", "modeller"],
  ["labeled", "labelled"],
  ["labeling", "labelling"],
  ["labeler", "labeller"],
  ["signaled", "signalled"],
  ["signaling", "signalling"],
  ["leveled", "levelled"],
  ["leveling", "levelling"],
  ["channeled", "channelled"],
  ["channeling", "channelling"],
  ["counseled", "counselled"],
  ["counseling", "counselling"],
  ["totaled", "totalled"],
  ["totaling", "totalling"],
];

// "-ize"/"-ise": covers organize/organization, customize, recognize, realize, utilize,
// summarize, finalize, optimize, prioritize, authorize, categorize, synchronize, standardize,
// capitalize, criticize, apologize, emphasize, specialize, minimize, maximize, normalize, etc.
const IZE_SUFFIX = /\b([a-z]+)iz(e|es|ed|ing|ation|ations|ational|er|ers|able)\b/i;
// Words that end in "iz" + one of the above suffixes but are NOT the "-ize" verb family —
// spelled identically in en-US and en-NZ. Checked against the whole matched word, lowercased.
const IZE_EXCLUSIONS = new Set([
  "size",
  "sizes",
  "sized",
  "sizing",
  "sizer",
  "sizers",
  "resize",
  "resizes",
  "resized",
  "resizing",
  "resizer",
  "resizers",
  "downsize",
  "downsizes",
  "downsized",
  "downsizing",
  "oversize",
  "oversized",
  "prize",
  "prizes",
  "prized",
  "prizing",
  "seize",
  "seizes",
  "seized",
  "seizing",
  "seizer",
  "seizers",
  "capsize",
  "capsizes",
  "capsized",
  "capsizing",
]);

// "-yze"/"-yse": analyze, analyzed, analyzing, analyzer, paralyze, catalyze.
const YZE_SUFFIX = /\b([a-z]+)yz(e|es|ed|ing|er|ers)\b/i;

// Ambiguous words whose correct NZ spelling depends on whether they're used as a noun or a verb
// (e.g. "licence" the noun vs. "license" the verb — "licensed"/"licensing" are unambiguously the
// verb form and are always correct as-is, so are deliberately excluded here). Flagged for manual
// review, no suggestion.
const AMBIGUOUS_WORDS = /\b(licenses?|practices?)\b/i;

/** JSX attributes whose string value is rendered as visible text, not a code-facing prop. */
const TEXT_ATTRIBUTES = new Set([
  "alt",
  "title",
  "label",
  "description",
  "placeholder",
  "aria-label",
  "aria-description",
  "helperText",
  "tooltip",
  "errorMessage",
  "displayName",
  "message",
  "term",
  "shortDefinition",
  "longDefinition",
]);

/**
 * @param {string} text
 * @returns {{ word: string, suggestion: string | null, index: number }[]}
 */
function findViolations(text) {
  const violations = [];
  const wordRegex = /[A-Za-z]+/g;
  let match;
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const lower = word.toLowerCase();

    const pair = WORD_PAIRS.find(([american]) => american === lower);
    if (pair && pair[0] !== pair[1]) {
      violations.push({ word, suggestion: pair[1], index: match.index });
      continue;
    }

    if (IZE_SUFFIX.test(word) && !IZE_EXCLUSIONS.has(lower)) {
      violations.push({
        word,
        suggestion: word.replace(/iz/i, (m) => (m === "IZ" ? "IS" : m === "Iz" ? "Is" : "is")),
        index: match.index,
      });
      continue;
    }

    if (YZE_SUFFIX.test(word)) {
      violations.push({
        word,
        suggestion: word.replace(/yz/i, (m) => (m === "YZ" ? "YS" : m === "Yz" ? "Ys" : "ys")),
        index: match.index,
      });
      continue;
    }

    if (AMBIGUOUS_WORDS.test(word)) {
      violations.push({ word, suggestion: null, index: match.index });
    }
  }
  return violations;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow American spellings in user-visible copy (en-NZ sweep guardrail).",
    },
    schema: [
      {
        type: "object",
        properties: {
          checkLabelProperties: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      americanSpelling: "'{{word}}' is American spelling — use '{{suggestion}}' (NZ English).",
      ambiguousSpelling:
        "'{{word}}' has different NZ spellings for noun vs. verb (e.g. licence/license) — check which applies.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const checkLabelProperties = options.checkLabelProperties ?? false;

    function report(node, text, textStartOffset) {
      for (const violation of findViolations(text)) {
        const start = textStartOffset + violation.index;
        const range = [start, start + violation.word.length];
        if (violation.suggestion) {
          context.report({
            node,
            loc: {
              start: context.sourceCode.getLocFromIndex(range[0]),
              end: context.sourceCode.getLocFromIndex(range[1]),
            },
            messageId: "americanSpelling",
            data: { word: violation.word, suggestion: violation.suggestion },
          });
        } else {
          context.report({
            node,
            loc: {
              start: context.sourceCode.getLocFromIndex(range[0]),
              end: context.sourceCode.getLocFromIndex(range[1]),
            },
            messageId: "ambiguousSpelling",
            data: { word: violation.word },
          });
        }
      }
    }

    return {
      JSXText(node) {
        // node.range[0] is the start of the raw text, which is what node.value mirrors.
        report(node, node.value, node.range[0]);
      },
      JSXAttribute(node) {
        if (typeof node.name?.name !== "string" || !TEXT_ATTRIBUTES.has(node.name.name)) {
          return;
        }
        const value = node.value;
        if (value?.type === "Literal" && typeof value.value === "string") {
          // +1 to skip the opening quote.
          report(node, value.value, value.range[0] + 1);
        } else if (
          value?.type === "JSXExpressionContainer" &&
          value.expression.type === "Literal" &&
          typeof value.expression.value === "string"
        ) {
          report(node, value.expression.value, value.expression.range[0] + 1);
        }
      },
      Literal(node) {
        if (!checkLabelProperties) return;
        if (typeof node.value !== "string") return;
        // Only the value half of a `label`/`description`/… property — e.g. `scope:
        // "organization"` in modules.ts is a discriminant value, not display copy, and
        // must never be flagged.
        const parent = node.parent;
        if (parent?.type !== "Property" || parent.value !== node) return;
        const keyName = parent.key.type === "Identifier" ? parent.key.name : parent.key.value;
        if (typeof keyName !== "string" || !TEXT_ATTRIBUTES.has(keyName)) return;
        report(node, node.value, node.range[0] + 1);
      },
    };
  },
};

export default rule;
