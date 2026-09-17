/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/account
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { UserAccountSettings } from "@/components/user-settings/user-account-settings";

export default async function UserSettings_Account_Page() {
    return (
        <>
            <Std.Navbar
                breadcrumbs={[{ label: "User Settings", href: "/user/settings" }, "Account"]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Account</Saratoga.Title>
                    </Saratoga.Header>
                    <UserAccountSettings />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
