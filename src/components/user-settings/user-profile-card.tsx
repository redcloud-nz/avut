/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { type SessionData } from "@/client/auth-queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemAction, DataItemTitle, DataItemValue } from "@/components/ui/data-item";
import { UserProfile_ChangeEmail_Dialog } from "@/components/user-settings/change-email-dialog";
import { UserProfile_UpdateName_Dialog } from "@/components/user-settings/update-name-dialog";
import { getUserInitials } from "@/lib/utils";

export function UserProfile_Card({ session }: { session: SessionData }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
                <DataItem>
                    <DataItemTitle>Avatar</DataItemTitle>
                    <DataItemValue>
                        <Avatar className="size-12 rounded-full">
                            {session.user.image && (
                                <AvatarImage src={session.user.image} alt="User Avatar" />
                            )}
                            <AvatarFallback className="rounded-full">
                                {getUserInitials(session.user.name)}
                            </AvatarFallback>
                        </Avatar>
                    </DataItemValue>
                </DataItem>

                <DataItem>
                    <DataItemTitle>Name</DataItemTitle>
                    <DataItemValue>{session.user.name}</DataItemValue>
                    <DataItemAction>
                        <UserProfile_UpdateName_Dialog session={session} />
                    </DataItemAction>
                </DataItem>

                <DataItem>
                    <DataItemTitle>Email</DataItemTitle>
                    <DataItemValue>{session.user.email}</DataItemValue>
                    <DataItemAction>
                        <UserProfile_ChangeEmail_Dialog session={session} />
                    </DataItemAction>
                </DataItem>
            </CardContent>
        </Card>
    );
}
