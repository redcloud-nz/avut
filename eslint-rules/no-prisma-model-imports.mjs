/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// Model types (`Skill`, `Person`, …) and enums from `@/generated/prisma` collide by name with the
// domain types in `src/lib/schemas` — `Skill` is both. So they are imported once, under a
// `<Name>Record` alias, in the schema file for that model, and re-exported from there
// (`export type { SkillRecord }`). Everything else imports the record type from the schema.
//
// Only the client machinery (`Prisma`, `PrismaClient`) may be imported from the generated
// package elsewhere; which names are allowed is configured per block in eslint.config.mjs, which
// also exempts `src/lib/schemas/`.

const GENERATED = /^@\/generated\/prisma(\/|$)/;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    docs: { description: "Model types come from the schema files, not the generated client" },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? []);

    /** @param {string} name */
    const message = (name) =>
      `\`${name}\` comes from the generated client. Import it via its schema file in @/lib/schemas ` +
      "(models as `<Name>Record`, exported there if they aren't yet). Only " +
      `${[...allow].map((n) => `\`${n}\``).join(" and ")} may be imported from the generated client here.`;

    /** @param {import("estree").Node} source @param {any[]} specifiers */
    function check(source, specifiers) {
      if (source?.type !== "Literal" || typeof source.value !== "string") return;
      if (!GENERATED.test(source.value)) return;

      for (const specifier of specifiers) {
        if (specifier.type === "ImportSpecifier" || specifier.type === "ExportSpecifier") {
          const imported =
            specifier.type === "ImportSpecifier" ? specifier.imported : specifier.local;
          const name = imported.type === "Identifier" ? imported.name : String(imported.value);
          if (!allow.has(name)) context.report({ node: specifier, message: message(name) });
        } else {
          // Default and namespace imports can't be checked name by name.
          context.report({ node: specifier, message: message("This import") });
        }
      }
    }

    return {
      ImportDeclaration: (node) => check(node.source, node.specifiers),
      ExportNamedDeclaration: (node) => node.source && check(node.source, node.specifiers),
      ExportAllDeclaration: (node) => check(node.source, [{ type: "ExportAllSpecifier", ...node }]),
    };
  },
};

export default rule;
