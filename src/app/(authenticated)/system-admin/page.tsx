/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";

import { requireGlobalAdmin } from "@/server/system-admin-access";

export default async function SystemAdmin_Index_Page() {
    await requireGlobalAdmin();

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["System Admin"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="System Administration">
                    <ItemGroup>
                        <Item asChild>
                            <Link href="/system-admin/organizations">
                                <ItemContent>
                                    <ItemTitle>Organizations</ItemTitle>
                                    <ItemDescription>
                                        Provision organizations, manage membership, and edit
                                        settings site-wide.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href="/system-admin/users">
                                <ItemContent>
                                    <ItemTitle>Users</ItemTitle>
                                    <ItemDescription>
                                        Inspect user accounts and their organization memberships.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
