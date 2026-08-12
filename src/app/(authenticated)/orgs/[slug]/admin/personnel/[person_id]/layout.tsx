/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, trpc } from "@/trpc/server";

// Reads through the same query options the page prefetches, so metadata and the page cost
// one database round trip between them. Unlike the previous unchecked lookup this runs the
// procedure's permission check and can therefore raise `forbidden()` — which is correct,
// and renders the same panel the layout's own guard would.
export async function generateMetadata(
    props: LayoutProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
): Promise<Metadata> {
    const { slug, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const person = await getServerQueryClient().fetchQuery(
        trpc.personnel.getPerson.queryOptions({
            organizationId: organization.id,
            personId: PersonId.schema.parse(person_id),
        }),
    );

    return {
        title: `${person.name} ${TITLE_SEPARATOR} Personnel`,
    };
}

export default async function AdminModule_Person_Layout(
    props: LayoutProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return props.children;
}
