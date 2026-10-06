/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users
 */

import { AdminModule_Users_List } from "@/components/admin/users/users-list";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Users`,
};

export default async function AdminModule_Users_Page(props: PageProps<"/orgs/[slug]/admin/users">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.organizations.listMembers.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.users.listPersonLinks.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Users", href: route("/orgs/[slug]/admin/users", { slug }) },
                ]}
                actions={<HelpButton id="admin" />}
            />
            <Std.ScrollContainer>
                <AdminModule_Users_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
