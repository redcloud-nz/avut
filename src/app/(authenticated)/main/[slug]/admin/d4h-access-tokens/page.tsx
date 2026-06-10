/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/d4h-access-tokens
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_D4hAccessTokensList } from "./d4h-access-tokens-list";

export const metadata = {
    title: `D4H Access Tokens`,
};

export default async function AdminModule_D4hAccessTokens_Page(
    props: PageProps<"/main/[slug]/admin/d4h-access-tokens">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    "D4H Access Tokens",
                ]}
            />
            <Std.ScrollContainer>
                <AdminModule_D4hAccessTokensList organization={organization} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
