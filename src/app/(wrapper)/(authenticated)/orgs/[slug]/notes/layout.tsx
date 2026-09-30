/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

import { Hermes } from "@/components/blocks/hermes";
import { HelpButton } from "@/components/docs/help-button";
import { Notes_ModuleGate } from "@/components/notes/notes-module-gate";
import { OrgNotes_Breadcrumbs, OrgNotes_List } from "@/components/notes/org-notes-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function Notes_Layout(props: LayoutProps<"/orgs/[slug]/notes">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.organizationNotes.listNotes.queryOptions({ organizationId: organization.id }));

    return (
        <Notes_ModuleGate>
            <HydrateClient>
                <OrgNotes_Breadcrumbs actions={<HelpButton slug="notes" />} />
                <Hermes.Root>
                    <Hermes.List>
                        <OrgNotes_List />
                    </Hermes.List>
                    <Hermes.Detail>{props.children}</Hermes.Detail>
                </Hermes.Root>
            </HydrateClient>
        </Notes_ModuleGate>
    );
}
