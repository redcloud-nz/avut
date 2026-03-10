/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/personal/settings
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { UserD4HAccessToken_Card } from "@/components/cards/user-d4h-access-token";
import { UserSettings_Card } from "@/components/cards/user-settings";

export default function Main_Personal_Settings_Page() {
    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["Personal", "Settings"]} />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.Title>User Settings</Hermes.Title>
                    </Hermes.Header>
                    {/* <UserSettings_Card /> */}
                    <UserD4HAccessToken_Card />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
