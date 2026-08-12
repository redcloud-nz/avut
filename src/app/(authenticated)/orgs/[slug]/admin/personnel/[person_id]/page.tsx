/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { Metadata } from "next";

import { AdminModule_Person_Content } from "@/components/admin/personnel/person-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/admin/personnel/[person_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const personId = PersonId.schema.parse(person_id);
    const person = await fetchQuery(
        trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }),
    );

    return {
        title: `${person.name} ${TITLE_SEPARATOR} Personnel`,
    };
}

export default async function AdminModule_Person_Page(props: Props) {
    const { slug, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const personId = PersonId.schema.parse(person_id);

    prefetch(trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }));
    prefetch(
        trpc.personnel.getLinkedUser.queryOptions({ organizationId: organization.id, personId }),
    );
    prefetch(
        trpc.teams.listTeamMemberships.queryOptions({ organizationId: organization.id, personId }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <AdminModule_Person_Content personId={personId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
