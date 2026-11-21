/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CircleCheckIcon, MinusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Glorious } from "@/components/blocks/glorious";
import { D4HTeamPickerDialog } from "@/components/d4h/team-picker-dialog";
import { I3TemplateLink } from "@/components/entity-links/i3-template-link";
import { AlertWarningIcon } from "@/components/icons";
import {
    DiagonalColumnHeader,
    DiagonalLeadColumnHeader,
} from "@/components/ui/diagonal-column-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3BundleId, I3BundleLine } from "@/lib/schemas/i3-bundle";
import { cn } from "@/lib/utils";
import {
    compareBundle,
    groupColumnsByCategory,
    type BundleCellState,
    type ExcludedLine,
    type ExcludedReason,
} from "@/modules/d4h-i3/lib/bundle-compare";
import type { ItemQualityState } from "@/modules/d4h-i3/lib/item-quality";
import { trpc } from "@/trpc/client";

// Opaque so cells scrolled beneath it stay hidden; the row hover is layered over the card
// colour as a gradient, since a translucent background would let them show through.
const stickyFirstCol =
    "sticky left-0 z-10 bg-card group-hover/row:bg-linear-to-r group-hover/row:from-accent/50 group-hover/row:to-accent/50";

// `HEADER_HEIGHT` must match the height `DiagonalColumnHeader` renders for `headerHeight`: it's
// the offset the sticky category row pins beneath.
const HEADER_HEIGHT = 130;
const CATEGORY_ROW_HEIGHT = 28;
const MEMBER_COL_WIDTH = 220;
const LINE_COL_WIDTH = 50;

const EXCLUDED_LABELS: Record<ExcludedReason, string> = {
    deleted: "Deleted template",
    "no-d4h-type": "No D4H type",
    "not-in-team": "Not used by this team",
};

/**
 * A bundle compared against one D4H team: a row per member and a column per comparable line,
 * grouped by category, each cell held (amber when its records fail the template's checks) or
 * missing. Lines that can't be compared are listed above the table. Reads D4H, so without a token
 * the queries fail and the error boundary explains.
 */
export function D4HI3Module_BundleMatrix({
    bundleId,
    teamId,
}: {
    bundleId: I3BundleId;
    teamId: number;
}) {
    const organization = useOrganization();
    const { slug } = organization;
    const organizationId = organization.id;

    const {
        data: { bundle, lines },
    } = useSuspenseQuery(trpc.i3Bundles.getBundle.queryOptions({ organizationId, bundleId }));

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId }),
    );

    // Check the team before reading its members, so an unknown team shows the not-found panel.
    const team = teams.find((t) => t.id === teamId);
    if (!team) notFound();

    const { data: members } = useSuspenseQuery(
        trpc.d4hApi.listTeamMembers.queryOptions({ organizationId, teamId }),
    );
    const { data: items } = useSuspenseQuery(
        trpc.d4hApi.listTeamIssuedEquipment.queryOptions({ organizationId, teamId }),
    );
    const {
        data: { templateIds },
    } = useSuspenseQuery(trpc.i3.listTemplateFits.queryOptions({ organizationId, teamId }));

    const { columns, excluded, rows, columnTotals } = compareBundle({
        lines,
        members,
        items,
        fittingTemplateIds: templateIds,
    });

    const categoryGroups = groupColumnsByCategory(columns);
    const categoryStarts = new Set(categoryGroups.map((group) => group.start));

    const memberCount = rows.length;

    return (
        <Glorious.Root>
            <Glorious.Header>
                <Glorious.Breadcrumbs
                    items={[
                        { label: "Bundles", href: route("/orgs/[slug]/d4h-i3/bundles", { slug }) },
                        {
                            label: bundle.name,
                            href: route("/orgs/[slug]/d4h-i3/bundles/[bundle_id]", {
                                slug,
                                bundle_id: bundle.id,
                            }),
                        },
                    ]}
                />
                <Glorious.Title>Compared with {team.title}</Glorious.Title>
                <Glorious.Subtitle>
                    {memberCount} {memberCount === 1 ? "member" : "members"} · {columns.length}{" "}
                    {columns.length === 1 ? "template" : "templates"}
                </Glorious.Subtitle>
                {teams.length > 1 && (
                    <Glorious.Actions>
                        <D4HTeamPickerDialog
                            section={(id) =>
                                route(
                                    "/orgs/[slug]/d4h-i3/bundles/[bundle_id]/teams/[d4h_team_id]",
                                    {
                                        slug,
                                        bundle_id: bundle.id,
                                        d4h_team_id: String(id),
                                    },
                                )
                            }
                        />
                    </Glorious.Actions>
                )}
            </Glorious.Header>

            {columns.length > 0 && rows.length > 0 && <CellMarkLegend />}

            {excluded.length > 0 && <D4HI3Module_BundleExcludedLines excluded={excluded} />}

            {columns.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>Nothing to compare</EmptyTitle>
                        <EmptyDescription>
                            {lines.length === 0
                                ? "Add templates to this bundle to compare it."
                                : `None of this bundle's templates can be compared with ${team.title}.`}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No members</EmptyTitle>
                        <EmptyDescription>{team.title} has no members to compare.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <Glorious.ScrollFrame>
                    <Glorious.Table>
                        <colgroup>
                            <col style={{ width: MEMBER_COL_WIDTH }} />
                            {columns.map((column) => (
                                <col key={column.template.id} style={{ width: LINE_COL_WIDTH }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                <th className={cn(stickyFirstCol, "top-0 z-30 p-0")}>
                                    <DiagonalLeadColumnHeader
                                        label="Member"
                                        headerHeight={HEADER_HEIGHT}
                                        columnWidth={MEMBER_COL_WIDTH}
                                    />
                                </th>
                                {columns.map((column) => (
                                    <th
                                        key={column.template.id}
                                        className="sticky top-0 z-20 p-0 font-medium"
                                    >
                                        <DiagonalColumnHeader
                                            label={column.template.name}
                                            headerHeight={HEADER_HEIGHT}
                                            columnWidth={LINE_COL_WIDTH}
                                        />
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                <th
                                    style={{ top: HEADER_HEIGHT, height: CATEGORY_ROW_HEIGHT }}
                                    className="sticky left-0 z-30 border-r border-b bg-card"
                                />
                                {categoryGroups.map((group) => (
                                    <th
                                        key={group.key}
                                        colSpan={group.span}
                                        style={{
                                            top: HEADER_HEIGHT,
                                            height: CATEGORY_ROW_HEIGHT,
                                        }}
                                        className="sticky z-20 border-b border-l bg-table-group px-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                                        title={group.title}
                                    >
                                        <div className="truncate">{group.title}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const memberHref = route(
                                    "/orgs/[slug]/d4h-i3/bundles/[bundle_id]/teams/[d4h_team_id]/members/[member_id]",
                                    {
                                        slug,
                                        bundle_id: bundle.id,
                                        d4h_team_id: String(teamId),
                                        member_id: String(row.member.id),
                                    },
                                );
                                return (
                                    <tr
                                        key={row.member.id}
                                        className="group/row hover:bg-accent/50"
                                    >
                                        <th
                                            scope="row"
                                            className={cn(
                                                stickyFirstCol,
                                                "border-r border-b px-3 py-1.5 text-left font-normal",
                                            )}
                                        >
                                            <div className="flex items-baseline justify-between gap-2">
                                                <Link
                                                    href={memberHref}
                                                    className="truncate hover:underline"
                                                    title={row.member.name}
                                                >
                                                    {row.member.name}
                                                </Link>
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    {row.heldCount} of {columns.length}
                                                </span>
                                            </div>
                                        </th>
                                        {row.cells.map((cell, i) => (
                                            <td
                                                key={columns[i].template.id}
                                                className={cn(
                                                    "border-b p-0 text-center",
                                                    i > 0 && "border-l",
                                                    categoryStarts.has(i) &&
                                                        i > 0 &&
                                                        "border-l-muted-foreground/40",
                                                    i === columns.length - 1 && "border-r",
                                                )}
                                            >
                                                <Link
                                                    href={memberHref}
                                                    className="block px-2 py-1.5 hover:bg-accent"
                                                >
                                                    <CellMark
                                                        state={cell.state}
                                                        quality={cell.quality}
                                                        label={`${row.member.name}: ${columns[i].template.name}`}
                                                    />
                                                </Link>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th
                                    scope="row"
                                    className="sticky bottom-0 left-0 z-30 border-r bg-card px-3 py-1.5 text-left font-medium"
                                >
                                    Holding
                                </th>
                                {columnTotals.map((total, i) => (
                                    <td
                                        key={columns[i].template.id}
                                        className={cn(
                                            "sticky bottom-0 z-20 bg-card px-1 py-1.5 text-center text-xs text-muted-foreground",
                                            i > 0 && "border-l",
                                            i === columns.length - 1 && "border-r",
                                        )}
                                        title={`${total} of ${memberCount} hold ${columns[i].template.name}`}
                                    >
                                        {total}/{memberCount}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </Glorious.Table>
                </Glorious.ScrollFrame>
            )}
        </Glorious.Root>
    );
}

type CellMarkKind = "held" | "incomplete" | "mismatch" | "missing";

const CELL_MARKS: Record<CellMarkKind, { icon: ReactNode; label: string }> = {
    held: {
        icon: <CircleCheckIcon className="mx-auto size-4 text-success" />,
        label: "held",
    },
    incomplete: {
        icon: <AlertWarningIcon className="mx-auto size-4 text-warning-foreground" />,
        label: "held, incomplete",
    },
    mismatch: {
        icon: <AlertWarningIcon className="mx-auto size-4 text-warning-foreground" />,
        label: "held, doesn't match",
    },
    missing: {
        icon: <MinusIcon className="mx-auto size-4 text-muted-foreground/50" />,
        label: "missing",
    },
};

const LEGEND: { kind: CellMarkKind; label: string }[] = [
    { kind: "held", label: "Held" },
    { kind: "incomplete", label: "Incomplete" },
    { kind: "mismatch", label: "Doesn't match" },
    { kind: "missing", label: "Missing" },
];

/** A held cell is flagged by its worst item's quality; an `ok` one stays the green check. */
function cellMarkKind(state: BundleCellState, quality: ItemQualityState | null): CellMarkKind {
    if (state === "missing") return "missing";
    return quality === "incomplete" || quality === "mismatch" ? quality : "held";
}

function CellMark({
    state,
    quality,
    label,
}: {
    state: BundleCellState;
    quality: ItemQualityState | null;
    label: string;
}) {
    const mark = CELL_MARKS[cellMarkKind(state, quality)];
    const text = `${label}, ${mark.label}`;
    return (
        <span role="img" aria-label={text} title={text} className="block">
            {mark.icon}
        </span>
    );
}

/** What each matrix mark means. */
function CellMarkLegend() {
    return (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {LEGEND.map(({ kind, label }) => (
                <li key={kind} className="flex items-center gap-1.5">
                    <span aria-hidden="true">{CELL_MARKS[kind].icon}</span>
                    {label}
                </li>
            ))}
        </ul>
    );
}

/** The lines left out of the comparison, by reason. The member comparison page shows it too. */
export function D4HI3Module_BundleExcludedLines({
    excluded,
}: {
    excluded: ExcludedLine<I3BundleLine>[];
}) {
    const reasons = (Object.keys(EXCLUDED_LABELS) as ExcludedReason[]).flatMap((reason) => {
        const reasonLines = excluded.filter((entry) => entry.reason === reason);
        return reasonLines.length > 0 ? [{ reason, lines: reasonLines }] : [];
    });

    return (
        <div className="text-sm text-muted-foreground">
            <span>Left out of the comparison: </span>
            {reasons.map(({ reason, lines }, reasonIndex) => (
                <Fragment key={reason}>
                    {reasonIndex > 0 && "; "}
                    {lines.map(({ line }, lineIndex) => (
                        <Fragment key={line.template.id}>
                            {lineIndex > 0 && ", "}
                            <I3TemplateLink template={line.template} />
                        </Fragment>
                    ))}{" "}
                    ({EXCLUDED_LABELS[reason]})
                </Fragment>
            ))}
            .
        </div>
    );
}
