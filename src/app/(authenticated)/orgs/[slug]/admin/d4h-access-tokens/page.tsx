/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import { AdminModule_D4hAccessTokensList } from "./d4h-access-tokens-list";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `D4H Access Tokens`,
};

export default async function AdminModule_D4hAccessTokens_Page(
    props: PageProps<"/orgs/[slug]/admin/d4h-access-tokens">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    prefetch(
        trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({
            organizationId: organization.id,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                        "D4H Access Tokens",
                    ]}
                />
                <Std.ScrollContainer>
                    <AdminModule_D4hAccessTokensList organization={organization} />
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
