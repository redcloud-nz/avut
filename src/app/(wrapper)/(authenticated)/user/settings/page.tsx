/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings
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

export default async function UserSettings_IndexPage() {
    return (
        <>
            <Std.Navbar breadcrumbs={["User Settings"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="User Settings">
                    <ItemGroup>
                        <Item asChild>
                            <Link href="/user/settings/account">
                                <ItemContent>
                                    <ItemTitle>Account</ItemTitle>
                                    <ItemDescription>
                                        Your name, avatar, and email address.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href="/user/settings/organizations">
                                <ItemContent>
                                    <ItemTitle>Organisations</ItemTitle>
                                    <ItemDescription>
                                        Organisations you belong to.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href="/user/settings/d4h">
                                <ItemContent>
                                    <ItemTitle>D4H</ItemTitle>
                                    <ItemDescription>Your D4H access tokens.</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
