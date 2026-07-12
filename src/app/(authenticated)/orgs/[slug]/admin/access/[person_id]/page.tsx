/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Suspense } from "react";

import { Std } from "@/components/blocks/std";
import { CardLoadingFallback } from "@/components/ui/card";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";
import { getPersonById } from "@/server/person";

import { AccessControl_Person } from "@/components/admin/access/access-control-user";

export default async function AdminModule_AccessControl_PersonPage(
    props: PageProps<"/orgs/[slug]/admin/access/[person_id]">,
) {
    const { slug, person_id } = await props.params;

    const organization = await getOrganizationBySlug(slug);
    const person = await getPersonById(organization.id, person_id);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Access Control", href: route("/orgs/[slug]/admin/access", { slug }) },
                    { label: person.name },
                ]}
            />
            <Std.ScrollContainer>
                <Suspense fallback={<CardLoadingFallback />}>
                    <AccessControl_Person personId={person.id} />
                </Suspense>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
