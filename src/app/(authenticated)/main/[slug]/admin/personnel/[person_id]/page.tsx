/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/personnel/[person_id]
 */
"use client";

import Link from "next/link";
import { use } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { AdminModule_PersonMenu } from "./person-menu";

export default function AdminModule_Person_Page(
    props: PageProps<`/main/[slug]/admin/personnel/[person_id]`>,
) {
    const { slug, person_id } = use(props.params);
    const organization = useOrganization();

    const [{ data: person }, { data: linkedUser }] = useSuspenseQueries({
        queries: [
            trpc.personnel.getPerson.queryOptions({
                organizationId: organization.id,
                personId: person_id,
            }),
            trpc.personnel.getLinkedUser.queryOptions({
                organizationId: organization.id,
                personId: person_id,
            }),
        ],
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Personnel", href: route("/main/[slug]/admin/personnel", { slug }) },
                    person.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/admin/personnel", { slug })}
                            tooltip="Back to personnel list"
                        />
                        <Hermes.Title>{person.name}</Hermes.Title>
                        <Hermes.Action>
                            <AdminModule_PersonMenu person={person} />
                        </Hermes.Action>
                    </Hermes.Header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Person Details</CardTitle>
                            <CardAction>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ person: ["update"] }}
                                >
                                    <Button variant="ghost" asChild>
                                        <Link
                                            href={route(
                                                "/main/[slug]/admin/personnel/[person_id]/--update",
                                                { slug, person_id },
                                            )}
                                        >
                                            <ObjectIcons.Edit />
                                        </Link>
                                    </Button>
                                </Protect>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Person ID</FieldLabel>
                                    <FieldValue value={person.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={person.name} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Email</FieldLabel>
                                    <FieldValue value={person.email} />
                                </Field>

                                <FieldSeparator />

                                <Field orientation="responsive">
                                    <FieldLabel>Created At</FieldLabel>
                                    <FieldValue
                                        value={person.createdAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated At</FieldLabel>
                                    <FieldValue
                                        value={person.updatedAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={person.status} />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    {linkedUser && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Linked User Account</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>User ID</FieldLabel>
                                        <FieldValue value={linkedUser.userId} format="id" />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <FieldValue value={linkedUser.name} />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Email</FieldLabel>
                                        <FieldValue value={linkedUser.email} />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Roles</FieldLabel>
                                        <FieldValue
                                            value={linkedUser.roles
                                                .map((role) => OrganizationRole.displayNames[role])
                                                .join(", ")}
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    )}
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
