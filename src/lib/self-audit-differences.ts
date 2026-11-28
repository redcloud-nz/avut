/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * A self audit campaign member's differences from D4H: where their submitted answer disagrees with
 * what D4H records as issued to them now, and how each could be fixed. Pure: the caller reads the
 * live comparison, open tasks and permissions. See decisions 4–6 of
 * `docs/plans/2026-11-28-self-audit-needs-and-fixes.md`.
 */

import * as z from "zod";

import type { D4HTaskKind } from "@/lib/schemas/d4h-task";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import {
    SelfAuditCampaignId,
    SelfAuditRequestId,
    type SelfAuditHeldItem,
    type SelfAuditResponseData,
    type SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { OTHER_VARIANT } from "@/lib/self-audit-types";
import { ANY_VARIANT } from "@/lib/self-audit-validate";

/** A D4H item the member holds now, as the differences read it. */
export type SelfAuditLiveItem = Pick<
    D4HEquipmentListItem,
    "id" | "ref" | "serial" | "kind" | "brand" | "model"
>;

/** An I3 variant's current D4H record, with the titles a `SetVariant` task names. */
export const SelfAuditVariantD4H = z.object({
    brandId: z.number(),
    brandTitle: z.string(),
    modelId: z.number(),
    modelTitle: z.string(),
});
export type SelfAuditVariantD4H = z.infer<typeof SelfAuditVariantD4H>;

/** An I3 template's current D4H record, as far as the differences read it. */
export type SelfAuditTemplateD4H = { kindTitle: string };

/** `Unlinked`: a stored template no longer linked to D4H, so its lines can't be compared. */
export const SelfAuditDifferenceKind = z.enum([
    "NotHeld",
    "Serial",
    "Variant",
    "Unrecorded",
    "Gone",
    "Unlinked",
]);
export type SelfAuditDifferenceKind = z.infer<typeof SelfAuditDifferenceKind>;

/** The task kinds a difference's fix can queue. */
export type SelfAuditFixTaskKind = Extract<D4HTaskKind, "SetSerial" | "SetVariant" | "MarkLost">;

/**
 * How a difference is fixed: a D4H write, or a task queued for someone to apply by hand.
 *
 * - `patch-lost`: `PATCH` the item's status to `LOST`.
 * - `create`: `POST` a new item located with the member: `variant` is the brand and model of the
 *   variant they picked, when it has a D4H record; `serial` is trimmed, `null` when they gave none.
 * - `task`: queue a `SetSerial`, `SetVariant` or `MarkLost` task.
 */
export const SelfAuditFix = z.discriminatedUnion("type", [
    z.object({ type: z.literal("patch-lost") }),
    z.object({
        type: z.literal("create"),
        variant: SelfAuditVariantD4H.nullable(),
        serial: z.string().nullable(),
    }),
    z.discriminatedUnion("taskKind", [
        z.object({ type: z.literal("task"), taskKind: z.literal("SetSerial"), serial: z.string() }),
        z.object({
            type: z.literal("task"),
            taskKind: z.literal("SetVariant"),
            brand: z.string(),
            model: z.string(),
        }),
        z.object({ type: z.literal("task"), taskKind: z.literal("MarkLost") }),
    ]),
]);
export type SelfAuditFix = z.infer<typeof SelfAuditFix>;

/**
 * - `selectable`: can be applied.
 * - `queued`: an open task already covers it.
 * - `unavailable`: has a fix, but it can't be applied (`reason` says why).
 * - `info`: information only, nothing to apply.
 */
export const SelfAuditDifferenceState = z.enum(["selectable", "queued", "unavailable", "info"]);
export type SelfAuditDifferenceState = z.infer<typeof SelfAuditDifferenceState>;

export const SelfAuditDifference = z.object({
    /**
     * Stable across recomputes while the difference and its fix stay the same:
     * `<kind>:<itemId>`, or `<kind>:<templateId>` with no item, then `:<fix>` when it has one
     * (`fixFingerprint`). So an apply whose recomputed fix differs from the one confirmed (the
     * permission it rests on changed, or the member resubmitted) finds no such key and skips it.
     */
    key: z.string(),
    kind: SelfAuditDifferenceKind,
    templateId: z.string(),
    /** The D4H item it's about; `null` for `Unrecorded` and `Unlinked`. */
    itemId: z.number().nullable(),
    /** What it's about, `#<ref> <kind>` style like `D4HTask.itemLabel`. */
    label: z.string(),
    /** What D4H has against what the member said. */
    detail: z.string(),
    fix: SelfAuditFix.nullable(),
    state: SelfAuditDifferenceState,
    reason: z.string().optional(),
});
export type SelfAuditDifference = z.infer<typeof SelfAuditDifference>;

/** A campaign's differences from D4H: an entry per submitted, not withdrawn, member. */
export const SelfAuditDifferences = z.object({
    /** The token's D4H Equipment permissions on the campaign's D4H team. */
    permissions: z.object({ update: z.boolean(), create: z.boolean() }),
    /** By member name; members with no differences included. */
    members: z.array(
        z.object({
            requestId: SelfAuditRequestId.schema,
            memberName: z.string(),
            /** Whether the member is still in the campaign's D4H team. */
            inTeam: z.boolean(),
            differences: z.array(SelfAuditDifference),
        }),
    ),
});
export type SelfAuditDifferences = z.infer<typeof SelfAuditDifferences>;

/** A difference an apply acted on, or tried to. */
const SelfAuditAppliedDifference = z.object({ key: z.string(), label: z.string() });

/**
 * What applying a member's selected differences did (decision 8 of
 * `docs/plans/2026-11-28-self-audit-needs-and-fixes.md`), by the keys sent.
 */
export const SelfAuditApplyResult = z.object({
    campaignId: SelfAuditCampaignId.schema,
    /**
     * Written to D4H: marked LOST, or created. `warning` when D4H has it but its log entry
     * failed.
     */
    applied: z.array(SelfAuditAppliedDifference.extend({ warning: z.string().optional() })),
    /** Queued as a D4H task. */
    queued: z.array(SelfAuditAppliedDifference),
    /** No longer a difference, or no longer selectable, when recomputed: not acted on. */
    skipped: z.array(z.object({ key: z.string() })),
    /** Tried and failed, with why. */
    failed: z.array(SelfAuditAppliedDifference.extend({ error: z.string() })),
});
export type SelfAuditApplyResult = z.infer<typeof SelfAuditApplyResult>;

export type SelfAuditDiffInput = {
    /** The campaign's stored templates, in their stored order. */
    templates: readonly SelfAuditTemplate[];
    /** The stored templates present in the live comparison (still linked to D4H). */
    liveTemplateIds: readonly string[];
    /** The request's snapshotted held items. */
    snapshotHeld: readonly SelfAuditHeldItem[];
    /** Per template id, the member's counted live items of that template's column. */
    live: Readonly<Record<string, readonly SelfAuditLiveItem[]>>;
    /** The member's submitted answer. */
    answer: SelfAuditResponseData;
    /** The D4H team's open tasks. */
    openTasks: readonly { resourceId: number; kind: D4HTaskKind }[];
    /** The token's D4H Equipment permissions on the campaign's D4H team. */
    permissions: { update: boolean; create: boolean };
    /** Whether the member is still in the D4H team. */
    inTeam: boolean;
    /** Per I3 variant id, its current D4H record; absent when it has none. */
    variantD4H: Readonly<Record<string, SelfAuditVariantD4H>>;
    /** Per I3 template id, its current D4H record; absent when it has none. */
    templateD4H: Readonly<Record<string, SelfAuditTemplateD4H>>;
};

const RETURNED = "Returned: retire task open";
const QUEUED = "Task already queued";
const VARIANT_UNLINKED = "Variant no longer linked to D4H";
const TEMPLATE_UNLINKED = "Template no longer linked to D4H";
const NOT_IN_TEAM = "No longer in the D4H team";
const NEEDS_CREATE = "Needs D4H Equipment CREATE";

function itemLabel(item: SelfAuditLiveItem): string {
    return `#${item.ref} ${item.kind.title}`;
}

/** A variant id that names a real variant: not blank, "Other" or "Any". */
function isRealVariant(variantId: string): boolean {
    return variantId !== "" && variantId !== OTHER_VARIANT && variantId !== ANY_VARIANT;
}

function brandModel(item: SelfAuditLiveItem): string {
    const parts = [item.brand.title, item.model?.title].filter(
        (part): part is string => !!part && part.trim() !== "",
    );
    return parts.length > 0 ? parts.join(" ") : "no brand/model";
}

/**
 * A fix as its difference's key names it: its type, task kind, and the serial, brand and model it
 * would write. Free text is URI-encoded, so it can't run into the separators.
 */
export function fixFingerprint(fix: SelfAuditFix): string {
    const text = (value: string | null) => (value === null ? "-" : encodeURIComponent(value));
    switch (fix.type) {
        case "patch-lost":
            return "lost";
        case "create":
            return `create=${fix.variant ? `${fix.variant.brandId}/${fix.variant.modelId}` : "-"}/${text(fix.serial)}`;
        case "task":
            switch (fix.taskKind) {
                case "MarkLost":
                    return "task-lost";
                case "SetSerial":
                    return `task-serial=${text(fix.serial)}`;
                case "SetVariant":
                    return `task-variant=${text(fix.brand)}/${text(fix.model)}`;
            }
    }
}

/** A difference's key: what it's about, then its fix (`SelfAuditDifference.key`). */
function differenceKey(base: string, fix: SelfAuditFix | null): string {
    return fix ? `${base}:${fixFingerprint(fix)}` : base;
}

/** One member's differences from D4H, in the stored templates' order (decision 4). */
export function diffAnswers(input: SelfAuditDiffInput): SelfAuditDifference[] {
    const {
        templates,
        snapshotHeld,
        live,
        answer,
        openTasks,
        permissions,
        inTeam,
        variantD4H,
        templateD4H,
    } = input;
    const liveTemplateIds = new Set(input.liveTemplateIds);

    const liveById = new Map<number, SelfAuditLiveItem>();
    for (const items of Object.values(live)) {
        for (const item of items) liveById.set(item.id, item);
    }
    const hasOpenTask = (itemId: number, kind: D4HTaskKind) =>
        openTasks.some((task) => task.resourceId === itemId && task.kind === kind);

    /** A task fix, Queued when an open task of its kind is already on the item. */
    const taskDifference = (
        base: Omit<SelfAuditDifference, "fix" | "state" | "reason"> & { itemId: number },
        fix: Extract<SelfAuditFix, { type: "task" }>,
    ): SelfAuditDifference =>
        hasOpenTask(base.itemId, fix.taskKind)
            ? { ...base, fix, state: "queued", reason: QUEUED }
            : { ...base, fix, state: "selectable" };

    const differences: SelfAuditDifference[] = [];

    for (const template of templates) {
        const heldOfTemplate = snapshotHeld.filter((held) => held.templateId === template.id);
        const missingAnswer = answer.missing[template.id];

        if (!liveTemplateIds.has(template.id) || !templateD4H[template.id]) {
            const answered =
                heldOfTemplate.some((held) => (answer.held[held.id]?.has ?? null) !== null) ||
                (missingAnswer?.has ?? null) !== null;
            if (answered) {
                differences.push({
                    key: `unlinked:${template.id}`,
                    kind: "Unlinked",
                    templateId: template.id,
                    itemId: null,
                    label: template.name,
                    detail: TEMPLATE_UNLINKED,
                    fix: null,
                    state: "info",
                });
            }
            continue;
        }

        for (const held of heldOfTemplate) {
            const heldAnswer = answer.held[held.id];
            if (!heldAnswer) continue;
            const itemId = Number(held.id);
            const liveItem = liveById.get(itemId);

            if (heldAnswer.has === "no") {
                // Already gone from the member (moved, deleted, LOST): nothing to fix.
                if (!liveItem) continue;
                const base = {
                    key: `notheld:${itemId}`,
                    kind: "NotHeld" as const,
                    templateId: template.id,
                    itemId,
                    label: itemLabel(liveItem),
                    detail: "D4H has it issued to them; they said they don't have it",
                };
                // An I3 Return leaves the item with the member until it's retired by hand.
                if (hasOpenTask(itemId, "Retire")) {
                    differences.push({ ...base, fix: null, state: "info", reason: RETURNED });
                } else if (hasOpenTask(itemId, "MarkLost")) {
                    // Queued even with UPDATE, so the item isn't PATCHed and the task orphaned.
                    differences.push({
                        ...base,
                        fix: { type: "task", taskKind: "MarkLost" },
                        state: "queued",
                        reason: QUEUED,
                    });
                } else if (permissions.update) {
                    differences.push({ ...base, fix: { type: "patch-lost" }, state: "selectable" });
                } else {
                    differences.push({
                        ...base,
                        fix: { type: "task", taskKind: "MarkLost" },
                        state: "selectable",
                    });
                }
                continue;
            }

            if (heldAnswer.has !== "yes") continue;

            if (!liveItem) {
                differences.push({
                    key: `gone:${itemId}`,
                    kind: "Gone",
                    templateId: template.id,
                    itemId,
                    label: held.description,
                    detail: "They said they have it; D4H no longer has it issued to them",
                    fix: null,
                    state: "info",
                });
                continue;
            }

            const serial = heldAnswer.serial.trim();
            const liveSerial = (liveItem.serial ?? "").trim();
            if (serial !== "" && serial !== liveSerial) {
                differences.push(
                    taskDifference(
                        {
                            key: `serial:${itemId}`,
                            kind: "Serial",
                            templateId: template.id,
                            itemId,
                            label: itemLabel(liveItem),
                            detail: `D4H: ${liveSerial === "" ? "no serial" : liveSerial}; they said ${serial}`,
                        },
                        { type: "task", taskKind: "SetSerial", serial },
                    ),
                );
            }

            const variantId = heldAnswer.variantId;
            if (isRealVariant(variantId)) {
                const said = variantD4H[variantId];
                const matches =
                    said !== undefined &&
                    liveItem.brand.id === said.brandId &&
                    (liveItem.model?.id ?? null) === said.modelId;
                if (!matches) {
                    const saidLabel =
                        template.variants.find((variant) => variant.id === variantId)?.label ??
                        variantId;
                    const base = {
                        key: `variant:${itemId}`,
                        kind: "Variant" as const,
                        templateId: template.id,
                        itemId,
                        label: itemLabel(liveItem),
                        detail: `D4H: ${brandModel(liveItem)}; they said ${saidLabel}`,
                    };
                    if (said === undefined) {
                        differences.push({
                            ...base,
                            fix: null,
                            state: "unavailable",
                            reason: VARIANT_UNLINKED,
                        });
                    } else {
                        differences.push(
                            taskDifference(base, {
                                type: "task",
                                taskKind: "SetVariant",
                                brand: said.brandTitle,
                                model: said.modelTitle,
                            }),
                        );
                    }
                }
            }
        }

        // Counted by D4H kind, so once a created item appears this converges and drops out.
        if (missingAnswer?.has === "yes" && (live[template.id]?.length ?? 0) === 0) {
            const serial = missingAnswer.serial.trim();
            const fix: SelfAuditFix = {
                type: "create",
                variant: isRealVariant(missingAnswer.variantId)
                    ? (variantD4H[missingAnswer.variantId] ?? null)
                    : null,
                serial: serial === "" ? null : serial,
            };
            const base = {
                key: `unrecorded:${template.id}`,
                kind: "Unrecorded" as const,
                templateId: template.id,
                itemId: null,
                label: template.name,
                detail: `They said they have one; D4H has no ${templateD4H[template.id].kindTitle} issued to them`,
                fix,
            };
            if (!inTeam) {
                differences.push({ ...base, state: "unavailable", reason: NOT_IN_TEAM });
            } else if (!permissions.create) {
                differences.push({ ...base, state: "unavailable", reason: NEEDS_CREATE });
            } else {
                differences.push({ ...base, state: "selectable" });
            }
        }
    }

    // Built with the base key; the fix is added last, from the fix each difference ended up with.
    return differences.map((difference) => ({
        ...difference,
        key: differenceKey(difference.key, difference.fix),
    }));
}
