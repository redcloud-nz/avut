/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs/csv
 */

import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, trpc } from "@/trpc/server";

type Ctx = { params: Promise<{ slug: string; campaign_id: string }> };

/**
 * A self audit campaign's needs report as a CSV download, a row per need. For system admins only:
 * the procedure checks the caller, so this route doesn't.
 */
export async function GET(_request: Request, { params }: Ctx) {
    const { slug, campaign_id } = await params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) notFound();
    const organization = await getOrganizationBySlug(slug);

    const parsed = SelfAuditCampaignId.schema.safeParse(campaign_id);
    if (!parsed.success) notFound();
    const campaignId = parsed.data;

    try {
        const csv = await fetchQuery(
            trpc.selfAuditCampaigns.getNeedsReportCsv.queryOptions({
                organizationId: organization.id,
                campaignId,
            }),
        );
        const date = new Date().toISOString().slice(0, 10);
        return new Response(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="self-audit-needs-${campaignId}-${date}.csv"`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        // `fetchQuery` already turns FORBIDDEN (not a system admin) into Next's 403 and NOT_FOUND
        // into its 404; an expired session reaches here as UNAUTHORIZED.
        if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
            return new Response("Sign in first.", { status: 401 });
        }
        throw error;
    }
}
