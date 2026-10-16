/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { type SessionData } from "@/client/auth-queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemAction,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { getUserInitials } from "@/lib/utils";

import { UserProfile_ChangeEmail_Dialog } from "./change-email";
import { UserSettings_UpdateName_Dialog } from "./update-name";

export function UserSettings_Profile_Card({ session }: { session: SessionData }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
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
                            <UserSettings_UpdateName_Dialog session={session} />
                        </DataItemAction>
                    </DataItem>

                    <DataItem>
                        <DataItemTitle>Email</DataItemTitle>
                        <DataItemValue>{session.user.email}</DataItemValue>
                        <DataItemAction>
                            <UserProfile_ChangeEmail_Dialog session={session} />
                        </DataItemAction>
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}
