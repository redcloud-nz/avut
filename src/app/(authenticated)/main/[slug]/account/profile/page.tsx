/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/account/profile
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { UserProfileInfo_Card } from "@/components/cards/user-profile-info";
import { UserLinkedAccounts_Card } from "@/components/cards/user-linked-accounts";

export default function Account_Profile_Page() {
    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["Account", "Profile"]} />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.Title>Profile</Hermes.Title>
                    </Hermes.Header>
                    <UserProfileInfo_Card />
                    <UserLinkedAccounts_Card />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
