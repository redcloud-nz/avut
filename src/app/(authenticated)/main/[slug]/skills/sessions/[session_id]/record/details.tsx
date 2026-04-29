/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

export function SkillsModule_SessionRecord_Details_Tab({
    session,
}: {
    session: SkillCheckSession;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Session details</CardTitle>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Field orientation="responsive">
                        <FieldLabel>Session ID</FieldLabel>
                        <FieldValue value={session.id} format="id" />
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Name</FieldLabel>
                        <FieldValue value={session.name} />
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Date</FieldLabel>
                        <FieldValue value={session.date} format="date" />
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Notes</FieldLabel>
                        <FieldValue value={session.notes} />
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Status</FieldLabel>
                        <FieldValue value={session.status} />
                    </Field>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
