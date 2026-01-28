/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { S2_Button } from "@/components/ui/s2-button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    S2_Card,
    S2_CardContent,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { S2_Value } from "@/components/ui/s2-value";

import { useOrganization } from "@/hooks/use-organization";

import { formatDateTime } from "@/lib/datetime";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { AdminModule_PersonMenu } from "./person-menu";

export default function AdminModule_Person_Page(
    props: PageProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
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
                    person.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.personnel}
                            >
                                Personnel
                            </Hermes.BackButton>
                            <ButtonGroup>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ person: ["update"] }}
                                >
                                    <S2_Button variant="outline" asChild>
                                        <Link
                                            to={
                                                Paths.org(slug).admin.person(
                                                    person_id,
                                                ).update
                                            }
                                        >
                                            <ObjectIcons.Edit /> Edit
                                        </Link>
                                    </S2_Button>
                                    <AdminModule_PersonMenu
                                        organization={organization}
                                        person={person}
                                    />
                                </Protect>
                            </ButtonGroup>
                        </Hermes.SectionHeader>

                        <S2_Card>
                            <S2_CardHeader>
                                <S2_CardTitle>{person.name}</S2_CardTitle>
                            </S2_CardHeader>
                            <S2_CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Person ID</FieldLabel>
                                        <S2_Value className="min-w-1/2">
                                            {person.id}
                                        </S2_Value>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <S2_Value className="min-w-1/2">
                                            {person.name}
                                        </S2_Value>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Email</FieldLabel>
                                        <S2_Value className="min-w-1/2">
                                            {person.email}
                                        </S2_Value>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created At</FieldLabel>
                                        <S2_Value className="min-w-1/2">
                                            {formatDateTime(person.createdAt)}
                                        </S2_Value>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Updated At</FieldLabel>
                                        <S2_Value className="min-w-1/2">
                                            {formatDateTime(person.updatedAt)}
                                        </S2_Value>
                                    </Field>
                                </FieldGroup>
                            </S2_CardContent>
                        </S2_Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
