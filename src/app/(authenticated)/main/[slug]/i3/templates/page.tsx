/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/templates
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

import { I3Module_CreateTemplate_Dialog } from "./create-template";
import { I3Module_TemplateList } from "./templates-list";

export const metadata = {
    title: "I3 Templates",
};

export default async function I3Module_TemplateList_Page(
    props: PageProps<"/main/[slug]/i3/templates">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "I3", href: route("/main/[slug]/i3", { slug }) },
                        "Templates",
                    ]}
                />
                <Std.ScrollContainer>
                    <Saratoga.Root>
                        <Saratoga.Header>
                            <Saratoga.Title>I3 Templates</Saratoga.Title>
                            <Saratoga.Actions>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ i3Template: ["create"] }}
                                >
                                    <I3Module_CreateTemplate_Dialog />
                                </Protect>
                            </Saratoga.Actions>
                        </Saratoga.Header>
                        <I3Module_TemplateList />
                    </Saratoga.Root>
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </>
    );
}
