/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/integrations
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { UserIntegrationsSettings } from "@/components/user-settings/user-integrations-settings";

export default async function UserSettings_Integrations_Page() {
    return (
        <>
            <Std.Navbar
                breadcrumbs={[{ label: "User Settings", href: "/user/settings" }, "D4H"]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>D4H</Saratoga.Title>
                    </Saratoga.Header>
                    <UserIntegrationsSettings />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
