/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { getPersonById } from "@/server/person";

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
    return props.children;
}
