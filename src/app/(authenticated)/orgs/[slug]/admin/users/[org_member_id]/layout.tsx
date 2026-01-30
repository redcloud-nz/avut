/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[org_member_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationMemberById } from "@/server/organization-member";

export async function generateMetadata(
    props: LayoutProps<"/orgs/[slug]/admin/users/[org_member_id]">,
): Promise<Metadata> {
    const { slug, org_member_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const orgMember = await getOrganizationMemberById(
        organization.id,
        org_member_id,
    );

    return {
        title: `${orgMember.user.name} ${TITLE_SEPARATOR} Users`,
    };
}

export default async function AdminModule_User_Layout(
    props: LayoutProps<"/orgs/[slug]/admin/users/[org_member_id]">,
) {
    return props.children;
}
