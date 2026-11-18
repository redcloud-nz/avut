/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Compare an I3 bundle against a D4H team: for each member and each comparable line, whether they
 * hold an item of the line's D4H type, and how the held items fare against the line's template
 * (`item-quality.ts`). Pure and structurally typed, so it runs on the client over
 * `i3Bundles.getBundle`, `d4hApi.listTeamMembers`, `d4hApi.listTeamIssuedEquipment` and
 * `i3.listTemplateFits`. See `docs/plans/2026-11-18-i3-bundles.md`, "What held means", and
 * `docs/plans/2026-11-19-i3-data-quality.md`, "Bundle cells".
 */

import {
    checkItemQuality,
    worstQuality,
    type ItemQualityItem,
    type ItemQualityResult,
    type ItemQualityRules,
    type ItemQualityState,
} from "./item-quality";

/** A bundle line, as far as the comparison reads it (`I3BundleLine` fits). */
export type BundleCompareLine = {
    template: {
        id: string;
        status: string;
        d4h: {
            kindId: number;
            requireSN: boolean;
            brandModelRule: ItemQualityRules["brandModelRule"];
        } | null;
        /** The brand/model pairs of the template's D4H variants. */
        variants: ItemQualityRules["variants"];
    };
};

/** A team member, as far as the comparison reads it. */
export type BundleCompareMember = { id: number; name: string };

/** An issued item with its holder, as `d4hApi.listTeamIssuedEquipment` returns it. */
export type BundleCompareItem = ItemQualityItem & {
    status: string;
    kind: { id: number };
    holder: { id: number };
};

/** A line that can be compared: its template is Active, has a D4H type and fits the team. */
export type ComparableLine<L extends BundleCompareLine> = L & {
    template: { d4h: NonNullable<L["template"]["d4h"]> };
};

/** Why a line is left out of the comparison. */
export type ExcludedReason = "deleted" | "no-d4h-type" | "not-in-team";

export type ExcludedLine<L extends BundleCompareLine> = { line: L; reason: ExcludedReason };

/** Whether the member has the kit. How good their records are is the cell's `quality`. */
export type BundleCellState = "held" | "missing";

export type BundleCell<I extends BundleCompareItem> = {
    state: BundleCellState;
    /** The worst quality among the counted items (one bad record isn't hidden); `null` when missing. */
    quality: ItemQualityState | null;
    /** The member's matching items that count, each judged against the line's template. */
    items: { item: I; quality: ItemQualityResult }[];
    /** The member's matching items marked LOST: they don't count, but the member page names them. */
    lost: I[];
};

export type BundleRow<M extends BundleCompareMember, I extends BundleCompareItem> = {
    member: M;
    /** Aligned with `columns`. */
    cells: BundleCell<I>[];
    /** How many columns the member holds. */
    heldCount: number;
};

export type BundleComparison<
    L extends BundleCompareLine,
    M extends BundleCompareMember,
    I extends BundleCompareItem,
> = {
    columns: ComparableLine<L>[];
    excluded: ExcludedLine<L>[];
    rows: BundleRow<M, I>[];
    /** Aligned with `columns`: how many members hold each one. */
    columnTotals: number[];
};

/** Statuses that never count as held. RETIRED is defensive: the list is fetched `only_current`. */
const LOST_STATUS = "LOST";
const RETIRED_STATUS = "RETIRED";

function excludedReason(
    line: BundleCompareLine,
    fittingTemplateIds: ReadonlySet<string>,
): ExcludedReason | null {
    // I3 templates have no archive, so a template that isn't Active is Deleted.
    if (line.template.status !== "Active") return "deleted";
    if (line.template.d4h === null) return "no-d4h-type";
    if (!fittingTemplateIds.has(line.template.id)) return "not-in-team";
    return null;
}

/** A run of adjacent columns in one D4H category. */
export type BundleCategoryGroup = {
    /** Unique among the groups, even when a category appears in more than one run. */
    key: string;
    categoryId: number;
    title: string;
    /** Index of the group's first column. */
    start: number;
    /** How many columns the group spans. */
    span: number;
};

/**
 * Group columns into runs of adjacent columns with the same category id. `getBundle` sorts lines by
 * category title then category id, and `compareBundle` keeps that order, so each category's
 * columns normally form one run. A category whose lines carry different title snapshots can
 * still split into several runs; each gets its own key.
 */
export function groupColumnsByCategory(
    columns: readonly { template: { d4h: { categoryId: number; categoryTitle: string } } }[],
): BundleCategoryGroup[] {
    const groups: BundleCategoryGroup[] = [];
    columns.forEach((column, index) => {
        const { categoryId, categoryTitle } = column.template.d4h;
        const last = groups.at(-1);
        if (last && last.categoryId === categoryId) last.span++;
        else
            groups.push({
                key: `${categoryId}-${index}`,
                categoryId,
                title: categoryTitle,
                start: index,
                span: 1,
            });
    });
    return groups;
}

export function compareBundle<
    L extends BundleCompareLine,
    M extends BundleCompareMember,
    I extends BundleCompareItem,
>({
    lines,
    members,
    items,
    fittingTemplateIds,
}: {
    lines: readonly L[];
    members: readonly M[];
    items: readonly I[];
    fittingTemplateIds: readonly string[];
}): BundleComparison<L, M, I> {
    const fitting = new Set(fittingTemplateIds);

    const columns: ComparableLine<L>[] = [];
    const excluded: ExcludedLine<L>[] = [];
    for (const line of lines) {
        const reason = excludedReason(line, fitting);
        if (reason === null) columns.push(line as ComparableLine<L>);
        else excluded.push({ line, reason });
    }

    const itemsByHolder = new Map<number, I[]>();
    for (const item of items) {
        if (item.status === RETIRED_STATUS) continue;
        const held = itemsByHolder.get(item.holder.id);
        if (held) held.push(item);
        else itemsByHolder.set(item.holder.id, [item]);
    }

    const columnRules = columns.map(
        ({ template }): ItemQualityRules => ({
            requireSN: template.d4h.requireSN,
            brandModelRule: template.d4h.brandModelRule,
            variants: template.variants,
        }),
    );

    const columnTotals = columns.map(() => 0);

    const rows = [...members]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((member): BundleRow<M, I> => {
            const memberItems = itemsByHolder.get(member.id) ?? [];
            let heldCount = 0;
            const cells = columns.map((column, index): BundleCell<I> => {
                const matching = memberItems.filter(
                    (item) => item.kind.id === column.template.d4h.kindId,
                );
                const counted = matching
                    .filter((item) => item.status !== LOST_STATUS)
                    .map((item) => ({ item, quality: checkItemQuality(item, columnRules[index]) }));
                const lost = matching.filter((item) => item.status === LOST_STATUS);
                const state: BundleCellState = counted.length > 0 ? "held" : "missing";
                if (state === "held") {
                    heldCount++;
                    columnTotals[index]++;
                }
                const quality = worstQuality(counted.map((entry) => entry.quality))?.state ?? null;
                return { state, quality, items: counted, lost };
            });
            return { member, cells, heldCount };
        });

    return { columns, excluded, rows, columnTotals };
}
