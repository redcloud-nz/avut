/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_AccessControl_PersonAccessControl_Card({
    personId,
}: {
    personId: PersonId;
}) {
    const organization = useOrganization();

    const { data: personnel } = useSuspenseQuery(
        trpc.accessControl.listPersonnelWithAccess.queryOptions({
            organizationId: organization.id,
        }),
    );

    const person = personnel.find((p) => p.id === personId);
    if (!person) throw new Error("Person() not found");

    return (
        <Card>
            <CardHeader>
                <CardTitle>Access for {person.name}</CardTitle>
                <CardAction></CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Field orientation="responsive">
                        <FieldLabel>Person ID</FieldLabel>
                        <FieldValue value={person.id} format="id" />
                    </Field>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
