/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground/select
 */

import { Std } from "@/components/blocks/std";

import { requireOrganization } from "@/server/organization-access";

import { Select_Sandbox } from "./sandbox";

export default async function Playground_Select_Page(
    props: PageProps<"/orgs/[slug]/playground/select">,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Playground", "Select"]} />
            <Std.ScrollContainer>
                <Select_Sandbox />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
