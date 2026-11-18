/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Compare an I3 bundle against a D4H team: for each member and each comparable line, whether they
 * hold an item of the line's D4H type. Pure and structurally typed, so it runs on the client over
 * `i3Bundles.getBundle`, `d4hApi.listTeamMembers`, `d4hApi.listTeamIssuedEquipment` and
 * `i3.listTemplateFits`. See `docs/plans/2026-11-18-i3-bundles.md`, "What held means".
 */

/** A bundle line, as far as the comparison reads it (`I3BundleLine` fits). */
export type BundleCompareLine = {
    template: {
        id: string;
        status: string;
        d4h: { kindId: number } | null;
    };
};

/** A team member, as far as the comparison reads it. */
export type BundleCompareMember = { id: number; name: string };

/** An issued item with its holder, as `d4hApi.listTeamIssuedEquipment` returns it. */
export type BundleCompareItem = {
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

/** A cell's state. #519 widens this with a data-quality state. */
export type BundleCellState = "held" | "missing";

export type BundleCell<I extends BundleCompareItem> = {
    state: BundleCellState;
    /** The member's matching items that count. */
    items: I[];
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
    if (line.template.status !== "Active") return "deleted";
    if (line.template.d4h === null) return "no-d4h-type";
    if (!fittingTemplateIds.has(line.template.id)) return "not-in-team";
    return null;
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
                const counted = matching.filter((item) => item.status !== LOST_STATUS);
                const lost = matching.filter((item) => item.status === LOST_STATUS);
                const state: BundleCellState = counted.length > 0 ? "held" : "missing";
                if (state === "held") {
                    heldCount++;
                    columnTotals[index]++;
                }
                return { state, items: counted, lost };
            });
            return { member, cells, heldCount };
        });

    return { columns, excluded, rows, columnTotals };
}
