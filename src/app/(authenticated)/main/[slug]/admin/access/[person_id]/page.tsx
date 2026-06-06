/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Suspense } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { CardLoadingFallback } from "@/components/ui/card";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";
import { getPersonById } from "@/server/person";

import { AdminModule_AccessControl_PersonAccessControl_Card } from "./person-access-control";

export default async function AdminModule_AccessControl_PersonPage(
    props: PageProps<"/main/[slug]/admin/access/[person_id]">,
) {
    const { slug, person_id } = await props.params;

    const organization = await getOrganizationBySlug(slug);
    const person = await getPersonById(organization.id, person_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Access Control", href: route("/main/[slug]/admin/access", { slug }) },
                    { label: person.name },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton href={route("/main/[slug]/admin/access", { slug })} />
                        <Hermes.Title>{person.name}</Hermes.Title>
                    </Hermes.Header>
                    <Suspense fallback={<CardLoadingFallback />}>
                        <AdminModule_AccessControl_PersonAccessControl_Card personId={person.id} />
                    </Suspense>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
