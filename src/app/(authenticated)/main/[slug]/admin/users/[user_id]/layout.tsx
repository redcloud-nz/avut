/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/users/[userId]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationUserById } from "@/server/organization-member";

export async function generateMetadata(
    props: LayoutProps<"/main/[slug]/admin/users/[user_id]">,
): Promise<Metadata> {
    const { slug, user_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const orgMember = await getOrganizationUserById(organization.id, user_id);

    return {
        title: `${orgMember.user.name} ${TITLE_SEPARATOR} Users`,
    };
}

export default async function AdminModule_User_Layout(
    props: LayoutProps<"/main/[slug]/admin/users/[user_id]">,
) {
    return props.children;
}
