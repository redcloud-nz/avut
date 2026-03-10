/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { headers as nextHeaders } from "next/headers";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                <FieldGroup>
                    <Field orientation="responsive">
                        <FieldLabel>User ID</FieldLabel>
                        <FieldValue value={session.user.id} format="id" />
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Email</FieldLabel>
                        <FieldValue value={session.user.email || "No email"} />
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Created At</FieldLabel>
                        <FieldValue
                            value={session.user.createdAt}
                            format="dateTimeWithDistance"
                        />
                    </Field>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
