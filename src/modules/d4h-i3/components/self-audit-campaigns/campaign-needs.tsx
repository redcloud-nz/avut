/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Fragment } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TablePanel,
    TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import type { SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import type { SelfAuditNeedsGroup } from "@/lib/self-audit-needs";
import { trpc } from "@/trpc/client";

/**
 * A self audit campaign's needs report: what its members asked for in their submitted answers,
 * by template, variant and size, then the needs not on the list, with a CSV download of both.
 */
export function D4HI3Module_SelfAuditCampaignNeeds({
    campaignId,
}: {
    campaignId: SelfAuditCampaignId;
}) {
    const organization = useOrganization();
    const { slug } = organization;

    const [{ data: campaign }, { data: report }] = useSuspenseQueries({
        queries: [
            trpc.selfAuditCampaigns.getCampaign.queryOptions({
                organizationId: organization.id,
                campaignId,
            }),
            trpc.selfAuditCampaigns.getNeedsReport.queryOptions({
                organizationId: organization.id,
                campaignId,
            }),
        ],
    });

    const isEmpty = report.groups.length === 0 && report.extras.length === 0;

    // The groups come in the campaign's template order; consecutive ones share a template.
    const templates: { templateId: string; templateName: string; groups: SelfAuditNeedsGroup[] }[] =
        [];
    for (const group of report.groups) {
        const last = templates.at(-1);
        if (last?.templateId === group.templateId) last.groups.push(group);
        else
            templates.push({
                templateId: group.templateId,
                templateName: group.templateName,
                groups: [group],
            });
    }

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Self Audit Campaigns",
                        href: route("/orgs/[slug]/d4h-i3/self-audit-campaigns", { slug }),
                    },
                    {
                        label: campaign.name,
                        href: route("/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]", {
                            slug,
                            campaign_id: campaign.id,
                        }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title>Needs Report</Saratoga.Title>
                {!isEmpty && (
                    <Saratoga.Actions>
                        {/* A route handler, which typed routes don't cover: its path is this
                            page's plus `/csv`. */}
                        <Button asChild variant="outline">
                            <a
                                href={`${route(
                                    "/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs",
                                    { slug, campaign_id: campaign.id },
                                )}/csv`}
                                download
                            >
                                <ObjectIcons.Export />
                                <span className="sr-only md:not-sr-only">Download CSV</span>
                            </a>
                        </Button>
                    </Saratoga.Actions>
                )}
            </Saratoga.Header>
            {isEmpty ? (
                <Empty>
                    <EmptyDescription>No submitted answers ask for anything yet.</EmptyDescription>
                </Empty>
            ) : (
                <>
                    {templates.length > 0 && (
                        <TablePanel>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHeadCell>Variant</TableHeadCell>
                                        <TableHeadCell>Size</TableHeadCell>
                                        <TableHeadCell className="w-24 text-center">
                                            Count
                                        </TableHeadCell>
                                        <TableHeadCell>Members</TableHeadCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {templates.map((template) => (
                                        <Fragment key={template.templateId}>
                                            <TableRow className="bg-table-group hover:bg-table-group">
                                                <TableHeadCell colSpan={4}>
                                                    {template.templateName}
                                                </TableHeadCell>
                                            </TableRow>
                                            {template.groups.map((group) => (
                                                <TableRow
                                                    key={`${group.variantLabel}\u0000${group.size}`}
                                                >
                                                    <TableCell className="pl-6">
                                                        {group.variantLabel}
                                                    </TableCell>
                                                    <TableCell>{group.size}</TableCell>
                                                    <TableCell className="text-center">
                                                        {group.count}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal">
                                                        {group.members.join(", ")}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </TablePanel>
                    )}
                    {report.extras.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-lg font-semibold tracking-tight">Other needs</h2>
                            <TablePanel>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHeadCell>Member</TableHeadCell>
                                            <TableHeadCell>Item</TableHeadCell>
                                            <TableHeadCell>Size</TableHeadCell>
                                            <TableHeadCell>Notes</TableHeadCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.extras.map((extra, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{extra.memberName}</TableCell>
                                                <TableCell>{extra.item}</TableCell>
                                                <TableCell>{extra.size}</TableCell>
                                                <TableCell className="whitespace-normal">
                                                    {extra.notes || "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TablePanel>
                        </section>
                    )}
                </>
            )}
        </Saratoga.Root>
    );
}
