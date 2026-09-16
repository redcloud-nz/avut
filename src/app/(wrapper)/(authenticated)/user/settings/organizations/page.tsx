/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/organizations
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { UserOrganizationsSettings } from "@/components/user-settings/user-organizations-settings";

export default async function UserSettings_Organizations_Page() {
    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "User Settings", href: "/user/settings" },
                    "Organisations",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Organisations</Saratoga.Title>
                    </Saratoga.Header>
                    <UserOrganizationsSettings />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
