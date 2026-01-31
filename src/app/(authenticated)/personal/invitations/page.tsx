/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Lexington } from "@/components/blocks/lexington";

import { TITLE_SEPARATOR } from "@/lib/constants";
import * as Paths from "@/paths";

import { Personal_Invitations_List } from "./invitations-list";

export const metadata = {
    title: `Invitations ${TITLE_SEPARATOR} Personal`,
    description: "Manage your organization invitations.",
};

export default function Personal_InvitationsList_Page() {
    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.personal.index, Paths.personal.invitations]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Personal_Invitations_List />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
