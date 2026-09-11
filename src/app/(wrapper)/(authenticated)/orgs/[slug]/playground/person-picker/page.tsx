/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground/person-picker
 */

import { Std } from "@/components/blocks/std";

import { requireOrganization } from "@/server/organization-access";

import { PersonPicker_Sandbox } from "./sandbox";

export default async function Playground_PersonPicker_Page(
    props: PageProps<"/orgs/[slug]/playground/person-picker">,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Playground", "Person picker"]} />
            <Std.ScrollContainer>
                <PersonPicker_Sandbox />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
