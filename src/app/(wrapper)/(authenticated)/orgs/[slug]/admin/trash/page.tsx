/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/trash
 */

import { AdminModule_Trash_List } from "@/components/admin/trash/trash-list";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { route } from "@/lib/routes";

export const metadata = {
    title: `Trash`,
};

export default async function AdminModule_Trash_Page(props: PageProps<"/orgs/[slug]/admin/trash">) {
    const { slug } = await props.params;
    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Trash", href: route("/orgs/[slug]/admin/trash", { slug }) },
                ]}
                actions={<HelpButton slug="admin" />}
            />
            <Std.ScrollContainer>
                <AdminModule_Trash_List />
            </Std.ScrollContainer>
        </>
    );
}
