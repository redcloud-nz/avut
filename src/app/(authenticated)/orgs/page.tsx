/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs
 */

import { AVUTLogo } from "@/components/art/avut-logo";
import { Argus } from "@/components/blocks/argus";
import { OrgSelector_Card } from "@/components/cards/org-selector";
import { getEntryControl } from "@/lib/entry-control";
import { redirect } from "next/navigation";

export default async function Main_Select_Page(props: PageProps<"/orgs">) {
    const entryControl = await getEntryControl();

    if (entryControl.status == "Proceed") {
        redirect(`/orgs/${entryControl.slug}`);
    }

    return (
        <Argus.Root>
            <Argus.Column>
                <AVUTLogo />
                <OrgSelector_Card app="orgs" entryControl={entryControl} />
            </Argus.Column>
        </Argus.Root>
    );
}
