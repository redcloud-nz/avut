/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonData, PersonId } from "@/lib/schemas/person";

import prisma from "./prisma";

/**
 * Get a person by their ID within an organization.
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `person-{personId}`.
 * - The `personId` parameter is not typed to allow easier integration with route parameters.
 * - If the person is not found, a 404 response is triggered.
 *
 * @param organizationId The ID of the organization.
 * @param personId The ID of the person.
 * @returns The person data.
 */
export async function getPersonById(
    organizationId: OrganizationId,
    personId: string,
): Promise<PersonData> {
    "use cache";
    cacheTag(`person-${personId}`);

    // Fetch person record
    const person = await prisma.person.findUnique({
        where: { organizationId, id: personId },
    });

    if (!person) return notFound();

    return PersonData.fromRecord(person);
}

/**
 * Revalidate the cache for a person.
 * @param personId The ID of the person.
 */
export async function revalidatePerson(personId: PersonId) {
    revalidateTag(`person-${personId}`, { expire: 0 });
}
