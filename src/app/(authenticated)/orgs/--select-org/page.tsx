/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--select-org
 */

import { redirect } from "next/navigation";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Argus } from "@/components/blocks/argus";
import { OrgSelector_Card } from "@/components/cards/org-selector";
import { getEntryControl } from "@/server/entry-control";
import { route } from "@/lib/routes";

export default async function SelectOrg_Page() {
    const entryControl = await getEntryControl();

    if (entryControl.status == "Proceed") {
        redirect(route(`/orgs/[slug]`, { slug: entryControl.slug }));
    }

    return (
        <Argus.Root>
            <Argus.Column>
                <AVUTLogo />
                <OrgSelector_Card entryControl={entryControl} />
            </Argus.Column>
        </Argus.Root>
    );
}
