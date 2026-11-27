/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/self-audit-campaigns
 */

import { Std } from "@/components/blocks/std";
import { D4HI3Module_SelfAuditCampaignList } from "@/modules/d4h-i3/components/self-audit-campaigns/campaign-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "Self Audit Campaigns",
};

// Unlinked and for system admins only: `selfAuditCampaigns` refuses anyone else.
export default async function D4HI3Module_SelfAuditCampaignList_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/self-audit-campaigns">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(
        trpc.selfAuditCampaigns.listCampaigns.queryOptions({ organizationId: organization.id }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <D4HI3Module_SelfAuditCampaignList />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
