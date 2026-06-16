/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/account/profile
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { UserProfileInfo_Card } from "@/components/cards/user-profile-info";
import { UserLinkedAccounts_Card } from "@/components/cards/user-linked-accounts";

export default function Account_Profile_Page() {
    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Account", "Profile"]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Profile</Saratoga.Title>
                    </Saratoga.Header>
                    <UserProfileInfo_Card />
                    <UserLinkedAccounts_Card />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
