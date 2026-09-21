/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/d4h
 */

import { Std } from "@/components/blocks/std";
import { UserSettings_D4HAccessTokensList } from "@/components/user-settings/d4h-access-tokens-list";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "D4H",
};

export default async function UserSettings_D4H_Page() {
    prefetch(trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions());
    prefetch(trpc.users.listMemberships.queryOptions());

    return (
        <HydrateClient>
            <Std.Navbar breadcrumbs={[{ label: "User Settings", href: "/user/settings" }, "D4H"]} />
            <Std.ScrollContainer>
                <UserSettings_D4HAccessTokensList />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
