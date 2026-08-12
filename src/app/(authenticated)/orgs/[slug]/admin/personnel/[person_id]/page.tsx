/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { AdminModule_Person_Content } from "./content";

export default async function AdminModule_Person_Page(
    props: PageProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
) {
    const { slug, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const personId = PersonId.schema.parse(person_id);
    const input = { organizationId: organization.id, personId };

    prefetch(trpc.personnel.getPerson.queryOptions(input));
    prefetch(trpc.personnel.getLinkedUser.queryOptions(input));

    return (
        <HydrateClient>
            <AdminModule_Person_Content slug={slug} personId={personId} />
        </HydrateClient>
    );
}
