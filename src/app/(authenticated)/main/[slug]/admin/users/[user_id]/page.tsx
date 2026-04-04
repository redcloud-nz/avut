/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/users/[user_id]
 */
"use client";

import { use, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";

import { trpc } from "@/trpc/client";

import AdminModule_UpdateUserRoles_Dialog from "./update-roles";
import { AdminModule_UserMenu } from "./user-menu";

export default function AdminModule_User_Page(
    props: PageProps<`/main/[slug]/admin/users/[user_id]`>,
) {
    const { slug, user_id } = use(props.params);

    const organization = useOrganization();

    const { data: session } = authClient.useSession();

    const { data: memberships } = useSuspenseQuery(
        trpc.organizations.listOrganizationMembers.queryOptions({
            organizationId: organization.id,
        }),
    );

    const organizationMembership = memberships.find((m) => m.userId === user_id);
    if (!organizationMembership) {
        throw new Error(`Organization membership for User(${user_id}) not found`);
    }

    const currentUserMembership = memberships.find((m) => m.userId === session?.user.id);
    if (!currentUserMembership) {
        throw new Error(`Current user's organization membership not found`);
    }

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: `/main/${slug}/admin` },
                    { label: "Users", href: `/main/${slug}/admin/users` },
                    {
                        label: organizationMembership.user.name,
                        href: `/main/${slug}/admin/users/${user_id}`,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={{ href: `/main/${slug}/admin/users` }}
                            tooltip="Back to users list"
                        />
                        <Hermes.Title>{organizationMembership.user.name}</Hermes.Title>
                        <Hermes.Action>
                            <AdminModule_UserMenu
                                organizationUser={organizationMembership}
                                user={organizationMembership.user}
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
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setUpdateDialogOpen(true)}
                                            >
                                                <ObjectIcons.Edit />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Edit user roles</TooltipContent>
                                    </Tooltip>
                                </Protect>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>User ID</FieldLabel>
                                    <FieldValue
                                        value={organizationMembership.user.id}
                                        format="id"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Organization Member ID</FieldLabel>
                                    <FieldValue value={organizationMembership.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={organizationMembership.user.name} />
                                </Field>

                                <Field orientation="responsive">
                                    <FieldLabel>Email</FieldLabel>
                                    <FieldValue>
                                        {organizationMembership.user.email}
                                        {organizationMembership.user.emailVerified ? (
                                            <span className="text-muted-foreground ml-2">
                                                (Verified)
                                            </span>
                                        ) : null}
                                    </FieldValue>
                                </Field>

                                <Field orientation="responsive">
                                    <FieldLabel>Role(s)</FieldLabel>
                                    <FieldValue
                                        value={organizationMembership.role
                                            .map((role) => OrganizationRole.displayNames[role])
                                            .join(", ")}
                                    />
                                </Field>

                                <FieldSeparator />

                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={organizationMembership.createdAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <AdminModule_UpdateUserRoles_Dialog
                        open={updateDialogOpen}
                        onOpenChange={setUpdateDialogOpen}
                        organizationMember={organizationMembership}
                        user={organizationMembership.user}
                        currentUserMembership={currentUserMembership}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
