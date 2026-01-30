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
import { ButtonGroup } from "@/components/ui/button-group";
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
import { formatDate } from "@/lib/datetime";
import { OrganizationRole } from "@/lib/schemas/organization-role";

import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { AdminModule_UserMenu } from "./user-menu";

export default function AdminModule_User_Page(
    props: PageProps<`/orgs/[slug]/admin/users/[org_member_id]`>,
) {
    const { slug, org_member_id } = use(props.params);

    const organization = useOrganization();

    const { data: orgMember } = useSuspenseQuery(
        trpc.organizations.getOrganizationMember.queryOptions({
            organizationId: organization.id,
            organizationMemberId: org_member_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.users,
                    orgMember.user.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(organization.slug).admin.users}
                            >
                                Users
                            </Hermes.BackButton>

                            <ButtonGroup>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ member: ["update"] }}
                                >
                                    <Button variant="outline" asChild>
                                        <Link
                                            to={
                                                Paths.org(
                                                    organization.slug,
                                                ).admin.user(org_member_id)
                                                    .update
                                            }
                                        >
                                            <ObjectIcons.Edit /> Edit
                                        </Link>
                                    </Button>
                                </Protect>
                                <AdminModule_UserMenu
                                    organization={organization}
                                    organizationMember={orgMember}
                                    user={orgMember.user}
                                />
                            </ButtonGroup>
                        </Hermes.SectionHeader>

                        <Card>
                            <CardHeader>
                                <CardTitle>{orgMember.user.name}</CardTitle>
                                <CardAction>
                                    {orgMember.user.image && (
                                        <img
                                            src={orgMember.user.image}
                                            alt={`${orgMember.user.name}'s profile image`}
                                            className="rounded-full w-12 h-12"
                                        />
                                    )}
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>User ID</FieldLabel>
                                        <FieldValue className="min-w-1/2">
                                            {orgMember.user.id}
                                        </FieldValue>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <FieldValue className="min-w-1/2">
                                            {orgMember.user.name}
                                        </FieldValue>
                                    </Field>

                                    <Field orientation="responsive">
                                        <FieldLabel>Email</FieldLabel>
                                        <FieldValue className="min-w-1/2">
                                            {orgMember.user.email}
                                            {orgMember.user.emailVerified ? (
                                                <span className="text-muted-foreground ml-2"></span>
                                            ) : null}
                                        </FieldValue>
                                    </Field>

                                    <FieldSeparator />

                                    <Field orientation="responsive">
                                        <FieldLabel>
                                            Organization Member ID
                                        </FieldLabel>
                                        <FieldValue className="min-w-1/2">
                                            {orgMember.id}
                                        </FieldValue>
                                    </Field>

                                    <Field orientation="responsive">
                                        <FieldLabel>Role</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={orgMember.role
                                                .map(
                                                    (role) =>
                                                        OrganizationRole
                                                            .displayNames[role],
                                                )
                                                .join(", ")}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created At</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={formatDate(
                                                orgMember.createdAt,
                                            )}
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
