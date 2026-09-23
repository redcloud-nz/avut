/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DLAction, DLActions, DLDetails, DLTerm } from "@/components/ui/description-list";
import { UserProfile_ChangeEmail_Dialog } from "@/components/user-settings/change-email-dialog";
import { UserProfile_UpdateName_Dialog } from "@/components/user-settings/update-name-dialog";
import { getUserInitials } from "@/lib/utils";
import { type AuthSession } from "@/server/auth";

export function UserProfile_Card({ session }: { session: AuthSession }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
                <DLActions>
                    <DLTerm>Avatar</DLTerm>
                    <DLDetails>
                        <Avatar className="size-12 rounded-full">
                            {session.user.image && (
                                <AvatarImage src={session.user.image} alt="User Avatar" />
                            )}
                            <AvatarFallback className="rounded-full">
                                {getUserInitials(session.user.name)}
                            </AvatarFallback>
                        </Avatar>
                    </DLDetails>

                    <DLTerm>Name</DLTerm>
                    <DLDetails>{session.user.name}</DLDetails>
                    <DLAction>
                        <UserProfile_UpdateName_Dialog session={session} />
                    </DLAction>

                    <DLTerm>Email</DLTerm>
                    <DLDetails>{session.user.email}</DLDetails>
                    <DLAction>
                        <UserProfile_ChangeEmail_Dialog session={session} />
                    </DLAction>
                </DLActions>
            </CardContent>
        </Card>
    );
}
