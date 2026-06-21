/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { headers as nextHeaders } from "next/headers";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { auth } from "@/server/auth";

export async function UserProfileInfo_Card() {
    const headers = await nextHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("User is not authenticated");

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
