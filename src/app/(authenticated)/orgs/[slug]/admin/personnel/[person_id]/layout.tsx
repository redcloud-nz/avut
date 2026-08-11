/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { requireOrganization } from "@/server/organization-access";
import { getPersonById } from "@/server/person";

// NOTE: `generateMetadata` must not redirect, so it uses the plain cached lookup. Access
// is gated by the ancestor organization and admin layouts.
export async function generateMetadata(
    props: LayoutProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
): Promise<Metadata> {
    const { slug, person_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const person = await getPersonById(organization.id, person_id);

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
