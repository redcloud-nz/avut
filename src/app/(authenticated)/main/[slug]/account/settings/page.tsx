/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/account/settings
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { UserSettings_Card } from "@/components/cards/user-settings";

export default function Account_Settings_Page() {
    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Account", "Settings"]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>User Settings</Saratoga.Title>
                    </Saratoga.Header>
                    <UserSettings_Card />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
