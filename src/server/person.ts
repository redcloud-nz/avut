/*
 *  Copyright (c) A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import { Person } from "@/lib/schemas/person";

import prisma from "./prisma";

export async function getPerson(
    organizationId: string,
    personId: string,
): Promise<Person> {
    "use cache";
    cacheTag(`person-${personId}`);

    // Fetch person record
    const person = await prisma.person.findUnique({
        where: { organizationId, id: personId },
    });

    if (!person) return notFound();

    return Person.fromRecord(person);
}

export async function revalidatePerson(personId: string) {
    revalidateTag(`person-${personId}`, { expire: 0 });
}
