/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { notFound } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { D4HEquipmentItemLink } from "@/components/entity-links/d4h-equipment-item-link";
import { D4HMemberLink } from "@/components/entity-links/d4h-member-link";
import { I3BundleLink } from "@/components/entity-links/i3-bundle-link";
import { I3TemplateLink } from "@/components/entity-links/i3-template-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { D4HI3Module_ItemQuality_Badge } from "@/modules/d4h-i3/components/item-quality-badge";
import {
    compareBundle,
    groupColumnsByCategory,
    type BundleCell,
} from "@/modules/d4h-i3/lib/bundle-compare";
import type { ItemQualityResult } from "@/modules/d4h-i3/lib/item-quality";
import { trpc, type RouterOutput } from "@/trpc/client";

import { D4HI3Module_BundleExcludedLines } from "./bundle-matrix";

type IssuedItem = RouterOutput["d4hApi"]["listTeamIssuedEquipment"][number];

/**
 * One member's row of a bundle comparison: each comparable line, grouped by category, held or
 * missing, with the items that match. Reads D4H, so without a token the queries fail and the
 * error boundary explains.
 */
export function D4HI3Module_BundleMemberComparison({
    bundleId,
    teamId,
    memberId,
}: {
    bundleId: I3BundleId;
    teamId: number;
    memberId: number;
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

    const { columns, excluded, rows } = compareBundle({
        lines,
        members,
        items,
        fittingTemplateIds: templateIds,
    });

    const row = rows.find((r) => r.member.id === memberId);
    if (!row) notFound();
    const { member } = row;

    const categoryGroups = groupColumnsByCategory(columns).map((group) => ({
        ...group,
        entries: columns
            .slice(group.start, group.start + group.span)
            .map((column, offset) => ({ column, cell: row.cells[group.start + offset] })),
    }));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Bundles", href: route("/orgs/[slug]/d4h-i3/bundles", { slug }) },
                    {
                        label: bundle.name,
                        href: route("/orgs/[slug]/d4h-i3/bundles/[bundle_id]", {
                            slug,
                            bundle_id: bundle.id,
                        }),
                    },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/d4h-i3/bundles/[bundle_id]/teams/[d4h_team_id]", {
                            slug,
                            bundle_id: bundle.id,
                            d4h_team_id: String(teamId),
                        }),
                    },
                    { label: member.name },
                ]}
                actions={<HelpButton id="d4h-i3/bundles" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{member.name}</Saratoga.Title>
                    </Saratoga.Header>
                    <p className="text-sm text-muted-foreground">
                        {row.heldCount} of {columns.length} held · Bundle:{" "}
                        <I3BundleLink bundle={bundle} /> · D4H Member:{" "}
                        <D4HMemberLink member={member} />
                    </p>

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
                    ) : (
                        categoryGroups.map((group) => (
                            <Card key={group.key}>
                                <CardHeader>
                                    <CardTitle>{group.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeadCell>Template</TableHeadCell>
                                                <TableHeadCell>Status</TableHeadCell>
                                                <TableHeadCell>Items</TableHeadCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.entries.map(({ column, cell }) => (
                                                <TableRow key={column.template.id}>
                                                    <TableCell className="align-top">
                                                        <I3TemplateLink
                                                            template={column.template}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <CellStatus cell={cell} />
                                                    </TableCell>
                                                    <TableCell className="align-top whitespace-normal">
                                                        <CellItems cell={cell} member={member} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ))
                    )}

                    {excluded.length > 0 && <D4HI3Module_BundleExcludedLines excluded={excluded} />}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

/** Held, Incomplete or Doesn't match (by the worst counted item's quality), or Missing. */
function CellStatus({ cell }: { cell: BundleCell<IssuedItem> }) {
    if (cell.state === "missing") return <Badge variant="outline">Missing</Badge>;
    if (cell.quality === "incomplete") return <Badge variant="outline">Incomplete</Badge>;
    if (cell.quality === "mismatch") return <Badge variant="outline">Doesn&apos;t match</Badge>;
    return <Badge variant="secondary">Held</Badge>;
}

/** The items behind a cell: those that count, or for a missing line, any marked Lost. */
function CellItems({ cell, member }: { cell: BundleCell<IssuedItem>; member: D4HMember }) {
    if (cell.state === "held") {
        return (
            <ul className="flex flex-col gap-1">
                {cell.items.map(({ item, quality }) => (
                    <ItemLine key={item.id} item={item} member={member} quality={quality} />
                ))}
            </ul>
        );
    }

    if (cell.lost.length === 0) return <span className="text-muted-foreground">—</span>;

    return (
        <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">
                {cell.lost.length} {cell.lost.length === 1 ? "item" : "items"} marked Lost
            </span>
            <ul className="flex flex-col gap-1">
                {cell.lost.map((item) => (
                    <ItemLine key={item.id} item={item} member={member} />
                ))}
            </ul>
        </div>
    );
}

/** One item, with its quality badge when it's a counted item (Lost items aren't judged). */
function ItemLine({
    item,
    member,
    quality,
}: {
    item: IssuedItem;
    member: D4HMember;
    quality?: ItemQualityResult;
}) {
    const brandModel = [item.brand.title, item.model?.title].filter(Boolean).join(" ");
    const details = [brandModel, item.serial, D4HEquipmentStatus.label(item.status)].filter(
        Boolean,
    );

    return (
        <li>
            <D4HEquipmentItemLink item={item} member={member} />
            {details.length > 0 && (
                <span className="text-muted-foreground"> · {details.join(" · ")}</span>
            )}
            {quality && quality.state !== "ok" && (
                <>
                    {" "}
                    <D4HI3Module_ItemQuality_Badge result={quality} item={item} />
                </>
            )}
        </li>
    );
}
