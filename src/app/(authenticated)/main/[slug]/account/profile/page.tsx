/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/account/profile
 */

import { headers as nextHeaders } from "next/headers";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { UserLinkedAccounts_Card } from "@/components/cards/user-linked-accounts";
import { auth } from "@/server/auth";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { ChevronRightIcon } from "lucide-react";

export default async function Account_Profile_Page() {
    const headers = await nextHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("User is not authenticated");

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Account", "Profile"]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Profile</Saratoga.Title>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>User Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>User ID</DLTerm>
                                        <DLDetails className="font-mono">
                                            {session.user.id}
                                        </DLDetails>

                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{session.user.name}</DLDetails>

                                        <DLTerm>Email</DLTerm>
                                        <DLDetails>{session.user.email || "No email"}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            <UserLinkedAccounts_Card />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Actions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Item asChild>
                                        <a>
                                            <ItemContent>
                                                <ItemTitle>Change Email</ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon />
                                            </ItemActions>
                                        </a>
                                    </Item>
                                    <Item asChild>
                                        <a>
                                            <ItemContent>
                                                <ItemTitle>Change Password</ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon />
                                            </ItemActions>
                                        </a>
                                    </Item>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
