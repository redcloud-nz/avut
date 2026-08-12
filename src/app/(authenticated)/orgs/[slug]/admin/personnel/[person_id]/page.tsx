/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, trpc } from "@/trpc/server";

import { AdminModule_Person_Content } from "./content";

type Props = PageProps<`/orgs/[slug]/admin/personnel/[person_id]`>;

/**
 * Resolve the route's person and their linked user account.
 *
 * `generateMetadata` and the page body both call this, but it costs a single round trip:
 * `requireOrganization` is React-`cache`d and `fetchQuery` writes into the request-scoped
 * query client, so the second call is a cache hit.
 */
async function resolvePerson(props: Props) {
    const { slug, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const input = {
        organizationId: organization.id,
        personId: PersonId.schema.parse(person_id),
    };

    const [person, linkedUser] = await Promise.all([
        fetchQuery(trpc.personnel.getPerson.queryOptions(input)),
        fetchQuery(trpc.personnel.getLinkedUser.queryOptions(input)),
    ]);

    return { slug, person, linkedUser };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { person } = await resolvePerson(props);

    return {
        title: `${person.name} ${TITLE_SEPARATOR} Personnel`,
    };
}

export default async function AdminModule_Person_Page(props: Props) {
    const { slug, person, linkedUser } = await resolvePerson(props);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Personnel", href: route("/orgs/[slug]/admin/personnel", { slug }) },
                    person.name,
                ]}
            />
            <Std.ScrollContainer>
                <AdminModule_Person_Content person={person} linkedUser={linkedUser} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
