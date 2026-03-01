/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { useOrganization } from "./use-organization";

export function usePerson(personId: string): PersonData {
    const organization = useOrganization();

    const { data: persons } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({
            organizationId: organization.id,
        }),
    );

    const person = persons.find((p) => p.id === personId);
    if (!person) throw new Error(`Person(${personId}) not found`);

    return person;
}
