/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/organization
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { ObjectIcons, SettingsIcon } from "@/components/icons";
import { Protect } from "@/components/protect";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";

export default async function AdminModule_Organization_Page(
    props: PageProps<`/orgs/[slug]/admin/organization`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.organization,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.Title>Organization</Hermes.Title>
                        <Protect
                            orgId={organization.id}
                            permissions={{ organization: ["update"] }}
                        >
                            <Button
                                variant="outline"
                                tooltip="Organization Settings"
                                size="icon"
                                asChild
                            >
                                <Link
                                    to={
                                        Paths.org(slug).admin.organization
                                            .settings
                                    }
                                >
                                    <SettingsIcon />
                                </Link>
                            </Button>
                        </Protect>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>{organization.name}</CardTitle>
                            <CardAction>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ organization: ["update"] }}
                                >
                                    <Button
                                        variant="ghost"
                                        tooltip="Edit Organization"
                                        size="icon"
                                        asChild
                                    >
                                        <Link
                                            to={
                                                Paths.org(slug).admin
                                                    .organization.update
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
                                    <FieldLabel>Organization ID</FieldLabel>
                                    <FieldValue
                                        format="id"
                                        value={organization.id}
                                        className="min-w-1/2"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue
                                        value={organization.name}
                                        className="min-w-1/2"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Slug</FieldLabel>
                                    <FieldValue
                                        value={organization.slug}
                                        className="min-w-1/2"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={organization.createdAt}
                                        format="dateTimeWithDistance"
                                        className="min-w-1/2"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
