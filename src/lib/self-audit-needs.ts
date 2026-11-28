/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * A self audit campaign's needs report: what its members asked for, as a purchase list. Built from
 * the requests' last submitted answers only (decisions 1–3 of
 * `docs/plans/2026-11-28-self-audit-needs-and-fixes.md`); the caller picks the requests.
 */

import * as z from "zod";

import { csvCell } from "@/lib/csv";
import type {
    SelfAuditAnswerData,
    SelfAuditHeldItem,
    SelfAuditResponseData,
    SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { OTHER_VARIANT } from "@/lib/self-audit-types";
import { ANY_VARIANT, wantsOne } from "@/lib/self-audit-validate";

/** One request as the report reads it: who answered, what they were asked, what they said. */
export type SelfAuditNeedsSource = {
    memberName: string;
    heldItems: readonly SelfAuditHeldItem[];
    submittedData: SelfAuditResponseData;
};

export type SelfAuditNeedsInput = {
    /** The campaign's stored templates, in their stored order. */
    templates: readonly SelfAuditTemplate[];
    requests: readonly SelfAuditNeedsSource[];
};

/** Needs of one template, variant and size. */
export const SelfAuditNeedsGroup = z.object({
    templateId: z.string(),
    templateName: z.string(),
    category: z.string(),
    variantLabel: z.string(),
    size: z.string(),
    count: z.number(),
    /** One per need, sorted: a member who needs two appears twice. */
    members: z.array(z.string()),
});
export type SelfAuditNeedsGroup = z.infer<typeof SelfAuditNeedsGroup>;

/** Something a member needs that isn't on the list. */
export const SelfAuditExtraNeed = z.object({
    memberName: z.string(),
    item: z.string(),
    size: z.string(),
    notes: z.string(),
});
export type SelfAuditExtraNeed = z.infer<typeof SelfAuditExtraNeed>;

/** The needs report: the grouped needs on the list, and the needs not on it. */
export const SelfAuditNeedsReport = z.object({
    groups: z.array(SelfAuditNeedsGroup),
    extras: z.array(SelfAuditExtraNeed),
});
export type SelfAuditNeedsReport = z.infer<typeof SelfAuditNeedsReport>;

/** The size of a need that gives none. */
export const NO_SIZE = "No size given";

type Need = {
    templateIndex: number;
    template: SelfAuditTemplate;
    variantLabel: string;
    size: string;
    memberName: string;
    reason: "Replacement" | "Has none";
    notes: string;
};

const collator = new Intl.Collator("en", { numeric: true });

function labelOf(template: SelfAuditTemplate, variantId: string): string {
    if (variantId === OTHER_VARIANT) return "Other";
    if (variantId === ANY_VARIANT) return "Any";
    return template.variants.find((variant) => variant.id === variantId)?.label ?? variantId;
}

/** Which variant a need is for (decision 2). */
function needVariantLabel(
    template: SelfAuditTemplate,
    held: SelfAuditHeldItem | null,
    answer: SelfAuditAnswerData,
): string {
    if (answer.has === "yes" && answer.replaceWith === "same") {
        const variantId = held?.variantId ?? (answer.variantId === "" ? null : answer.variantId);
        return variantId === null ? "Unknown" : labelOf(template, variantId);
    }
    // A template with no variants asks no "which one" of a replacement.
    if (answer.wantVariantId === "") return "—";
    return labelOf(template, answer.wantVariantId);
}

/** Every need on the list, sorted by template (stored order), variant, size, then member. */
function listNeeds({ templates, requests }: SelfAuditNeedsInput): Need[] {
    const templateIndex = new Map(templates.map((template, index) => [template.id, index]));

    const needs = requests.flatMap(({ memberName, heldItems, submittedData }) => {
        const answered: {
            templateId: string;
            held: SelfAuditHeldItem | null;
            answer: SelfAuditAnswerData;
        }[] = [
            ...heldItems.flatMap((held) => {
                const answer = submittedData.held[held.id];
                return answer ? [{ templateId: held.templateId, held, answer }] : [];
            }),
            ...Object.entries(submittedData.missing).map(([templateId, answer]) => ({
                templateId,
                held: null,
                answer,
            })),
        ];
        return answered.flatMap(({ templateId, held, answer }): Need[] => {
            const index = templateIndex.get(templateId);
            if (index === undefined || !wantsOne(answer)) return [];
            const template = templates[index];
            return [
                {
                    templateIndex: index,
                    template,
                    variantLabel: needVariantLabel(template, held, answer),
                    size: answer.size.trim() || NO_SIZE,
                    memberName,
                    reason: answer.has === "yes" ? "Replacement" : "Has none",
                    notes: answer.notes.trim(),
                },
            ];
        });
    });

    return needs.toSorted(
        (a, b) =>
            a.templateIndex - b.templateIndex ||
            collator.compare(a.variantLabel, b.variantLabel) ||
            collator.compare(a.size, b.size) ||
            collator.compare(a.memberName, b.memberName),
    );
}

/** The extra rows of kind `need`, by member. */
function listExtras({ requests }: SelfAuditNeedsInput): SelfAuditExtraNeed[] {
    return requests
        .flatMap(({ memberName, submittedData }) =>
            submittedData.extras
                .filter((extra) => extra.kind === "need")
                .map((extra) => ({
                    memberName,
                    item: extra.item.trim(),
                    size: extra.size.trim() || NO_SIZE,
                    notes: extra.notes.trim(),
                })),
        )
        .toSorted((a, b) => collator.compare(a.memberName, b.memberName));
}

/**
 * The needs grouped by template (in the campaign's stored order), then variant, then size, each
 * group with its count and members; and the needs not on the list.
 */
export function buildNeedsReport(input: SelfAuditNeedsInput): SelfAuditNeedsReport {
    const groups: SelfAuditNeedsGroup[] = [];
    for (const need of listNeeds(input)) {
        const last = groups.at(-1);
        if (
            last &&
            last.templateId === need.template.id &&
            last.variantLabel === need.variantLabel &&
            last.size === need.size
        ) {
            last.count++;
            last.members.push(need.memberName);
        } else {
            groups.push({
                templateId: need.template.id,
                templateName: need.template.name,
                category: need.template.category,
                variantLabel: need.variantLabel,
                size: need.size,
                count: 1,
                members: [need.memberName],
            });
        }
    }
    return { groups, extras: listExtras(input) };
}

/** The template cell of a need that isn't on the list. */
export const NOT_ON_LIST = "(not on list)";

/**
 * The needs report as one CSV file: a row per need (not per group), in the report's order, then
 * the needs not on the list, with the item as the variant.
 */
export function needsReportCsv(input: SelfAuditNeedsInput): string {
    const header = ["Template", "Variant", "Size", "Member", "Reason", "Notes"];
    const rows = [
        ...listNeeds(input).map((need) => [
            need.template.name,
            need.variantLabel,
            need.size,
            need.memberName,
            need.reason,
            need.notes,
        ]),
        ...listExtras(input).map((extra) => [
            NOT_ON_LIST,
            extra.item,
            extra.size,
            extra.memberName,
            "",
            extra.notes,
        ]),
    ];
    return [header, ...rows].map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
