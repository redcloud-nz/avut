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

import type { D4HTaskKind } from "@/lib/schemas/d4h-task";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import type {
    SelfAuditHeldItem,
    SelfAuditResponseData,
    SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { OTHER_VARIANT } from "@/lib/self-audit-types";
import { ANY_VARIANT } from "@/lib/self-audit-validate";

/** A D4H item the member holds now, as the differences read it. */
export type SelfAuditLiveItem = Pick<
    D4HEquipmentListItem,
    "id" | "ref" | "serial" | "kind" | "brand" | "model"
>;

/** An I3 variant's current D4H record, with the titles a `SetVariant` task names. */
export type SelfAuditVariantD4H = {
    brandId: number;
    brandTitle: string;
    modelId: number;
    modelTitle: string;
};

/** An I3 template's current D4H record, as far as the differences read it. */
export type SelfAuditTemplateD4H = { kindTitle: string };

export type SelfAuditDifferenceKind =
    | "NotHeld"
    | "Serial"
    | "Variant"
    | "Unrecorded"
    | "Gone"
    /** A stored template no longer linked to D4H: its lines can't be compared. */
    | "Unlinked";

/** The task kinds a difference's fix can queue. */
export type SelfAuditFixTaskKind = Extract<D4HTaskKind, "SetSerial" | "SetVariant" | "MarkLost">;

/** How a difference is fixed: a D4H write, or a task queued for someone to apply by hand. */
export type SelfAuditFix =
    /** `PATCH` the item's status to `LOST`. */
    | { type: "patch-lost" }
    /** `POST` a new item located with the member. */
    | {
          type: "create";
          /** Brand and model, when the member picked a variant with a D4H record. */
          variant: SelfAuditVariantD4H | null;
          /** Trimmed; `null` when the member gave none. */
          serial: string | null;
      }
    | { type: "task"; taskKind: "SetSerial"; serial: string }
    | { type: "task"; taskKind: "SetVariant"; brand: string; model: string }
    | { type: "task"; taskKind: "MarkLost" };

/**
 * - `selectable`: can be applied.
 * - `queued`: an open task already covers it.
 * - `unavailable`: has a fix, but it can't be applied (`reason` says why).
 * - `info`: information only, nothing to apply.
 */
export type SelfAuditDifferenceState = "selectable" | "queued" | "unavailable" | "info";

export type SelfAuditDifference = {
    /** Stable across recomputes: `<kind>:<itemId>`, or `<kind>:<templateId>` with no item. */
    key: string;
    kind: SelfAuditDifferenceKind;
    templateId: string;
    /** The D4H item it's about; `null` for `Unrecorded` and `Unlinked`. */
    itemId: number | null;
    /** What it's about, `#<ref> <kind>` style like `D4HTask.itemLabel`. */
    label: string;
    /** What D4H has against what the member said. */
    detail: string;
    fix: SelfAuditFix | null;
    state: SelfAuditDifferenceState;
    reason?: string;
};

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

    return differences;
}
