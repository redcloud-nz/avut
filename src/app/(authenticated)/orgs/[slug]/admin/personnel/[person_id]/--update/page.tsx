/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]/--update
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { AdminModule_UpdatePerson_Form } from "./update-person";

export default function AdminModule_PersonUpdate_Page(
    props: PageProps<`/orgs/[slug]/admin/personnel/[person_id]/--update`>,
) {
    const { slug, person_id } = use(props.params);
    const organization = useOrganization();

    const { data: person } = useSuspenseQuery(
        trpc.personnel.getPerson.queryOptions({
            organizationId: organization.id,
            personId: person_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.personnel,
                    {
                        href: Paths.org(slug).admin.person(person_id).href,
                        label: person.name,
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.person(person_id)}
                            >
                                {person.name}
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>Update Person</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminModule_UpdatePerson_Form
                                    organization={organization}
                                    person={person}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
