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
import { route } from "@/lib/routes";
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

    const { data: organizationUsers } = useSuspenseQuery(
        trpc.accessControl.listOrganizationUsers.queryOptions({
            organizationId: organization.id,
        }),
    );

    const targetUser = organizationUsers.find((m) => m.userId === user_id);
    if (!targetUser) {
        throw new Error(`Organization membership for User(${user_id}) not found`);
    }

    const currentUser = organizationUsers.find((m) => m.userId === session?.user.id);
    if (!currentUser) {
        throw new Error(`Current user's organization membership not found`);
    }

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Users", href: route("/main/[slug]/admin/users", { slug }) },
                    {
                        label: targetUser.name,
                        href: route("/main/[slug]/admin/users/[user_id]", { slug, user_id }),
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/admin/users", { slug })}
                            tooltip="Back to users list"
                        />
                        <Hermes.Title>{targetUser.name}</Hermes.Title>
                        <Hermes.Action>
                            <AdminModule_UserMenu user={targetUser} />
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
                                    <FieldValue value={targetUser.userId} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={targetUser.name} />
                                </Field>

                                <Field orientation="responsive">
                                    <FieldLabel>Email</FieldLabel>
                                    <FieldValue>{targetUser.email}</FieldValue>
                                </Field>

                                <Field orientation="responsive">
                                    <FieldLabel>Role(s)</FieldLabel>
                                    <FieldValue
                                        value={targetUser.roles
                                            .map((role) => OrganizationRole.displayNames[role])
                                            .join(", ")}
                                    />
                                </Field>

                                <FieldSeparator />

                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={targetUser.createdAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated</FieldLabel>
                                    <FieldValue
                                        value={targetUser.updatedAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <AdminModule_UpdateUserRoles_Dialog
                        open={updateDialogOpen}
                        onOpenChange={setUpdateDialogOpen}
                        user={targetUser}
                        currentUser={currentUser}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
