/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { D4HI3Module_SelfAuditCampaignNeeds } from "@/modules/d4h-i3/components/self-audit-campaigns/campaign-needs";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, campaign_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const campaignId = SelfAuditCampaignId.schema.parse(campaign_id);
    const campaign = await fetchQuery(
        trpc.selfAuditCampaigns.getCampaign.queryOptions({
            organizationId: organization.id,
            campaignId,
        }),
    );

    return {
        title: `${campaign.name} Needs Report ${TITLE_SEPARATOR} Self Audit Campaigns`,
    };
}

// Unlinked and for system admins only: `selfAuditCampaigns` refuses anyone else.
export default async function D4HI3Module_SelfAuditCampaignNeeds_Page(props: Props) {
    const { slug, campaign_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const campaignId = SelfAuditCampaignId.schema.parse(campaign_id);

    prefetch(
        trpc.selfAuditCampaigns.getCampaign.queryOptions({
            organizationId: organization.id,
            campaignId,
        }),
    );
    prefetch(
        trpc.selfAuditCampaigns.getNeedsReport.queryOptions({
            organizationId: organization.id,
            campaignId,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <D4HI3Module_SelfAuditCampaignNeeds campaignId={campaignId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
