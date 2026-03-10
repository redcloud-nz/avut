/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/personnel/[person_id]
 */
"use client";

import { use } from "react";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { usePerson } from "@/hooks/use-person";
import * as Paths from "@/paths";

import { AdminModule_PersonMenu } from "./person-menu";

export default function AdminModule_Person_Page(
    props: PageProps<`/main/[slug]/admin/personnel/[person_id]`>,
) {
    const { slug, person_id } = use(props.params);
    const organization = useOrganization();

    const person = usePerson(person_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.personnel,
                    person.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.main(slug).admin.personnel}
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
                                            to={
                                                Paths.main(slug).admin.person(
                                                    person_id,
                                                ).update
                                            }
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
