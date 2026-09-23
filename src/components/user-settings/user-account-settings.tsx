/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSession } from "@/client/auth-queries";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DLAction, DLActions, DLDetails, DLTerm } from "@/components/ui/description-list";
import { RainbowSpinner } from "@/components/ui/loading";
import { UserProfile_ChangePassword_Dialog } from "@/components/user-settings/change-password-dialog";
import { UserProfile_Card } from "@/components/user-settings/user-profile-card";

import { ActiveSessions_Card } from "./active-sessions-card";
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
                    <DLActions>
                        <DLTerm>Password</DLTerm>
                        <DLDetails>********</DLDetails>
                        <DLAction>
                            <UserProfile_ChangePassword_Dialog />
                        </DLAction>
                    </DLActions>
                </CardContent>
            </Card>
            <LinkedAccounts_Card />
            <ActiveSessions_Card />
        </div>
    );
}
