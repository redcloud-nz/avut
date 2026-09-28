/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSession } from "@/client/auth-queries";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemAction, DataItemTitle, DataItemValue } from "@/components/ui/data-item";
import { RainbowSpinner } from "@/components/ui/loading";
import { UserProfile_ChangePassword_Dialog } from "@/components/user-settings/change-password-dialog";
import { UserProfile_Card } from "@/components/user-settings/user-profile-card";

import { ActiveSessions_Card } from "./active-sessions-card";
import { UserSettings_CloseAccount_Dialog } from "./close-account-dialog";
import { LinkedAccounts_Card } from "./linked-accounts-card";

export function UserAccountSettings() {
    const sessionQuery = useSession();

    if (sessionQuery.isPending) {
        return <RainbowSpinner className="mx-auto" />;
    }

    if (!sessionQuery.data) {
        return <Alert variant="error">No user data available</Alert>;
    }

    return (
        <div className="space-y-4">
            <UserProfile_Card session={sessionQuery.data} />
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Manage your security settings</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataItem>
                        <DataItemTitle>Password</DataItemTitle>
                        <DataItemValue>********</DataItemValue>
                        <DataItemAction>
                            <UserProfile_ChangePassword_Dialog />
                        </DataItemAction>
                    </DataItem>
                </CardContent>
            </Card>
            <LinkedAccounts_Card />
            <ActiveSessions_Card />
            <Card>
                <CardHeader>
                    <CardTitle>Close Account</CardTitle>
                    <CardDescription>
                        Stop using AVUT and have your account deleted.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataItem>
                        <DataItemTitle>Account</DataItemTitle>
                        <DataItemValue>{sessionQuery.data.user.email}</DataItemValue>
                        <DataItemAction>
                            <UserSettings_CloseAccount_Dialog
                                email={sessionQuery.data.user.email}
                            />
                        </DataItemAction>
                    </DataItem>
                </CardContent>
            </Card>
        </div>
    );
}
