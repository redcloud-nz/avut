/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/rubbish-bin
 */

import { AdminModule_Trash_List } from "@/components/admin/trash/trash-list";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { route } from "@/lib/routes";

export const metadata = {
    title: `Rubbish`,
};

export default async function AdminModule_Trash_Page(
    props: PageProps<"/orgs/[slug]/admin/rubbish-bin">,
) {
    const { slug } = await props.params;
    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Rubbish", href: route("/orgs/[slug]/admin/rubbish-bin", { slug }) },
                ]}
                actions={<HelpButton slug="admin" />}
            />
            <Std.ScrollContainer>
                <AdminModule_Trash_List />
            </Std.ScrollContainer>
        </>
    );
}
