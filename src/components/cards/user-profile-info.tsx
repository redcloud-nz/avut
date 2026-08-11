/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { requireSession } from "@/server/session";

export async function UserProfileInfo_Card() {
    const session = await requireSession();

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
                <DL>
                    <DLTerm>User ID</DLTerm>
                    <DLDetails className="font-mono">{session.user.id}</DLDetails>

                    <DLTerm>Name</DLTerm>
                    <DLDetails>{session.user.name}</DLDetails>

                    <DLTerm>Email</DLTerm>
                    <DLDetails>{session.user.email || "No email"}</DLDetails>
                </DL>
            </CardContent>
        </Card>
    );
}
