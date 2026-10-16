/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

import { Suspense } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Notes_ModuleGate } from "@/modules/notes/components/notes-module-gate";
import { OrgNotes_Breadcrumbs, OrgNotes_List } from "@/modules/notes/components/org-notes-list";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function Notes_Layout(props: LayoutProps<"/orgs/[slug]/notes">) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    // Checked here as well as in `Notes_ModuleGate`, so nothing is prefetched (and dehydrated into
    // the page) for an org that can't use the module.
    if (await isOrganizationModuleUsable(slug, "notes")) {
        prefetch(
            trpc.organizationNotes.listNotes.queryOptions({ organizationId: organization.id }),
        );
    }

    const helpButton = <HelpButton id="notes" />;

    return (
        <Notes_ModuleGate>
            <HydrateClient>
                <Suspense fallback={<Std.Navbar breadcrumbs={["Notes"]} actions={helpButton} />}>
                    <OrgNotes_Breadcrumbs actions={helpButton} />
                </Suspense>
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
