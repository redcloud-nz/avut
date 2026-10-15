/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]/history
 */

import { Metadata } from "next";

import { AdminModule_PersonHistory_Content } from "@/components/admin/personnel/person-history-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { PersonId } from "@/lib/schemas/person";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/admin/personnel/[person_id]/history`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, person_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const personId = PersonId.schema.parse(person_id);
    const person = await fetchQuery(
        trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }),
    );

    return {
        title: `${person.name} History ${TITLE_SEPARATOR} Personnel`,
    };
}

export default async function AdminModule_PersonHistory_Page(props: Props) {
    const { slug, person_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const personId = PersonId.schema.parse(person_id);

    prefetch(trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }));
    // Same input as `ObjectHistory`'s client query (no `limit`), so the keys match.
    prefetchInfinite(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            { organizationId: organization.id, objectType: "Person", objectId: personId },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return (
        <HydrateClient>
            <AdminModule_PersonHistory_Content personId={personId} />
        </HydrateClient>
    );
}
