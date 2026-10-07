/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/invitations
 */

import { AdminModule_Invitations_List } from "@/components/admin/invitations/invitations-list";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Invitations`,
};

export default async function AdminModule_Invitations_Page(
    props: PageProps<"/orgs/[slug]/admin/invitations">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.invitations.listInvitations.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    {
                        label: "Invitations",
                        href: route("/orgs/[slug]/admin/invitations", { slug }),
                    },
                ]}
                actions={<HelpButton id="admin/invitations" />}
            />
            <Std.ScrollContainer>
                <AdminModule_Invitations_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
