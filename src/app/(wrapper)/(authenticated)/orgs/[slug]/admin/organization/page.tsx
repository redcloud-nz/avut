/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/organization
 */

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { AdminModule_Organization_Content } from "@/modules/org-admin/components/organization/organization-content";
import { getOrganizationBySlug } from "@/server/cache/organization";

export default async function AdminModule_Organization_Page(
    props: PageProps<`/orgs/[slug]/admin/organization`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.ScrollContainer>
            <Saratoga.Root>
                <Saratoga.Header>
                    <Saratoga.Title>Organisation</Saratoga.Title>
                </Saratoga.Header>
                <AdminModule_Organization_Content
                    organization={{
                        id: organization.id,
                        name: organization.name,
                        slug: organization.slug,
                    }}
                />
            </Saratoga.Root>
        </Std.ScrollContainer>
    );
}
