/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import { AdminModule_Users_List } from "./users-list";

export const metadata = {
    title: `Users`,
};

export default async function AdminModule_Users_Page(props: PageProps<"/orgs/[slug]/admin/users">) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Users", href: route("/orgs/[slug]/admin/users", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <AdminModule_Users_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
