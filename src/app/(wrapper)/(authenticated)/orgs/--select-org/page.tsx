/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--select-org
 */

import { Route } from "next";
import { redirect } from "next/navigation";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Argus } from "@/components/blocks/argus";
import { OrgSelector_Card } from "@/components/cards/org-selector";
import { getEntryControl } from "@/server/entry-control";

export default async function SelectOrg_Page(props: PageProps<"/orgs/--select-org">) {
    const params = await props.searchParams;
    const moduleId = Array.isArray(params.module) ? params.module[0] : params.module;

    const entryControl = await getEntryControl();

    if (entryControl.status == "Proceed") {
        if (moduleId) {
            redirect(`/orgs/${entryControl.slug}/${moduleId}` as Route);
        } else {
            redirect(`/orgs/${entryControl.slug}` as Route);
        }
    }

    return (
        <Argus.Root>
            <Argus.Column>
                <AVUTLogo />
                <OrgSelector_Card entryControl={entryControl} module={moduleId} />
            </Argus.Column>
        </Argus.Root>
    );
}
