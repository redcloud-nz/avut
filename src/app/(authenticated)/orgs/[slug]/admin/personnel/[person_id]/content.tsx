/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Suspense, useState } from "react";

import { AdminModule_PersonMenu } from "@/components/admin/personnel/person-menu";
import { AdminModule_Person_TeamMemberships_Card } from "@/components/admin/personnel/team-memberships";
import { AdminModule_UpdatePerson_Dialog } from "@/components/admin/personnel/update-person";
import { Saratoga } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardLoadingFallback,
    CardTitle,
} from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { PersonData } from "@/lib/schemas/person";
import { RouterOutput } from "@/trpc/client";

export function AdminModule_Person_Content({
    person,
    linkedUser,
}: {
    person: PersonData;
    linkedUser: RouterOutput["personnel"]["getLinkedUser"];
}) {
    const organization = useOrganization();

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>{person.name}</Saratoga.Title>
                <Saratoga.Actions>
                    <AdminModule_PersonMenu person={person} />
                </Saratoga.Actions>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <Card>
                        <CardHeader>
                            <CardTitle>Person Details</CardTitle>
                            <CardAction>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ person: ["update"] }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setUpdateDialogOpen(true)}
                                    >
                                        <ObjectIcons.Edit />
                                    </Button>
                                    <AdminModule_UpdatePerson_Dialog
                                        person={person}
                                        open={updateDialogOpen}
                                        onOpenChange={setUpdateDialogOpen}
                                    />
                                </Protect>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <DL>
                                <DLTerm>Person ID</DLTerm>
                                <DLDetails className="font-mono">{person.id}</DLDetails>
                                <DLTerm>Name</DLTerm>
                                <DLDetails>{person.name}</DLDetails>
                                <DLTerm>Email</DLTerm>
                                <DLDetails>{person.email}</DLDetails>
                                <DLTerm>Status</DLTerm>
                                <DLDetails>{person.status}</DLDetails>
                            </DL>
                        </CardContent>
                    </Card>
                    {linkedUser && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Linked User Account</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DL>
                                    <DLTerm>User ID</DLTerm>
                                    <DLDetails className="font-mono">{linkedUser.userId}</DLDetails>
                                    <DLTerm>Name</DLTerm>
                                    <DLDetails>{linkedUser.name}</DLDetails>
                                    <DLTerm>Email</DLTerm>
                                    <DLDetails>{linkedUser.email}</DLDetails>
                                    <DLTerm>Roles</DLTerm>
                                    <DLDetails>
                                        {linkedUser.roles
                                            .map((role) => OrganizationRole.displayNames[role])
                                            .join(", ")}
                                    </DLDetails>
                                </DL>
                            </CardContent>
                        </Card>
                    )}
                </Saratoga.Column>
                <Saratoga.Column slot="secondary">
                    <Suspense fallback={<CardLoadingFallback />}>
                        <AdminModule_Person_TeamMemberships_Card personId={person.id} />
                    </Suspense>
                    <Card>
                        <CardContent>
                            <DL>
                                <DLTerm>Created</DLTerm>
                                <DLDetails>
                                    <div>{formatDateTime(person.createdAt)}</div>

                                    <div className="text-muted-foreground">
                                        {formatRelativeDateTime(person.createdAt)}
                                    </div>
                                </DLDetails>
                                <DLTerm>Updated</DLTerm>
                                <DLDetails>
                                    <div>{formatDateTime(person.updatedAt)}</div>

                                    <div className="text-muted-foreground">
                                        {formatRelativeDateTime(person.updatedAt)}
                                    </div>
                                </DLDetails>
                            </DL>
                        </CardContent>
                    </Card>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
