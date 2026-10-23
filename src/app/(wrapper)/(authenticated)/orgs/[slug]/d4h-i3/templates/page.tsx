/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/templates
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { route } from "@/lib/routes";
import { D4HI3Module_CreateTemplate_Dialog } from "@/modules/d4h-i3/components/templates/create-template";
import { D4HI3Module_TemplateList } from "@/modules/d4h-i3/components/templates/templates-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "I3 Templates",
};

export default async function D4HI3Module_TemplateList_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/templates">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.i3.listTemplates.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    "Templates",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>I3 Templates</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ i3Template: ["create"] }}>
                                <D4HI3Module_CreateTemplate_Dialog />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <D4HI3Module_TemplateList />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
