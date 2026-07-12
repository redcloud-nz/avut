/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_PersonnelList } from "./personnel-list";

export const metadata = {
    title: `Personnel`,
};

export default async function AdminModule_PersonnelList_Page(
    props: PageProps<"/orgs/[slug]/admin/personnel">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Personnel", href: route("/orgs/[slug]/admin/personnel", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <AdminModule_PersonnelList organization={organization} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
