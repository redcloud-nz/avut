/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[org_member_id]
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
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
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { AdminModule_UserMenu } from "./user-menu";

export default function AdminModule_User_Page(
    props: PageProps<`/orgs/[slug]/admin/users/[org_member_id]`>,
) {
    const { slug, org_member_id } = use(props.params);

    const organization = useOrganization();

    const { data: orgUser } = useSuspenseQuery(
        trpc.organizations.getOrganizationUser.queryOptions({
            organizationId: organization.id,
            organizationUserId: org_member_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.users,
                    orgUser.user.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.org(organization.slug).admin.users}
                                tooltip="Back to users list"
                            />
                            <Hermes.Title>{orgUser.user.name}</Hermes.Title>
                            <Hermes.Action>
                                <AdminModule_UserMenu
                                    organizationUser={orgUser}
                                    user={orgUser.user}
                                />
                            </Hermes.Action>
                        </Hermes.Header>

                        <Card>
                            <CardHeader>
                                <CardTitle>User Details</CardTitle>
                                <CardAction>
                                    <Protect
                                        orgId={organization.id}
                                        permissions={{ member: ["update"] }}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            asChild
                                        >
                                            <Link
                                                to={
                                                    Paths.org(
                                                        organization.slug,
                                                    ).admin.user(org_member_id)
                                                        .update
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
                                        <FieldLabel>User ID</FieldLabel>
                                        <FieldValue
                                            value={orgUser.user.id}
                                            format="id"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <FieldValue value={orgUser.user.name} />
                                    </Field>

                                    <Field orientation="responsive">
                                        <FieldLabel>Email</FieldLabel>
                                        <FieldValue>
                                            {orgUser.user.email}
                                            {orgUser.user.emailVerified ? (
                                                <span className="text-muted-foreground ml-2"></span>
                                            ) : null}
                                        </FieldValue>
                                    </Field>

                                    <FieldSeparator />

                                    <Field orientation="responsive">
                                        <FieldLabel>
                                            Organization Member ID
                                        </FieldLabel>
                                        <FieldValue
                                            value={orgUser.id}
                                            format="id"
                                        />
                                    </Field>

                                    <Field orientation="responsive">
                                        <FieldLabel>Role</FieldLabel>
                                        <FieldValue
                                            value={orgUser.role
                                                .map(
                                                    (role) =>
                                                        OrganizationRole
                                                            .displayNames[role],
                                                )
                                                .join(", ")}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created</FieldLabel>
                                        <FieldValue
                                            value={orgUser.createdAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
