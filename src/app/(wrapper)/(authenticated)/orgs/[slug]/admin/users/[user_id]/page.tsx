/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[user_id]
 */

import { AdminModule_User_Content } from "@/components/admin/users/user-content";
import { UserId } from "@/lib/schemas/user";
import { getOrganizationBySlug } from "@/server/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// A server page, so the `?action=` dialogs on this page don't remount it: a client page that read
// its params with `use(props.params)` re-suspended and flashed the page spinner (#76). The member
// list comes from the better-auth client, so it is fetched by the content component instead.
export default async function AdminModule_User_Page(
    props: PageProps<"/orgs/[slug]/admin/users/[user_id]">,
) {
    const { slug, user_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const userId = UserId.schema.parse(user_id);

    prefetch(trpc.users.getLinkedPerson.queryOptions({ organizationId: organization.id, userId }));

    return (
        <HydrateClient>
            <AdminModule_User_Content userId={userId} />
        </HydrateClient>
    );
}
