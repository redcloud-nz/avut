/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/access
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import { AccessControl_List } from "@/components/admin/access/access-control-list";

export const metadata = {
    title: `Access Control`,
};

export default async function AdminModule_AccessControl_Page(
    props: PageProps<"/main/[slug]/admin/access">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Access Control", href: route("/main/[slug]/admin/access", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <AccessControl_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
