/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/organizations
 */

import { Std } from "@/components/blocks/std";
import { UserSettings_OrganizationsList } from "@/components/user-settings/organizations-list";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "Organisations",
};

export default async function UserSettings_Organizations_Page() {
    prefetch(trpc.user.listMemberships.queryOptions());

    return (
        <HydrateClient>
            <Std.Navbar
                breadcrumbs={[{ label: "User Settings", href: "/user/settings" }, "Organisations"]}
            />
            <Std.ScrollContainer>
                <UserSettings_OrganizationsList />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
