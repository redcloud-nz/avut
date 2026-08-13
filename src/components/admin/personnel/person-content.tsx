/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Suspense } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
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
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_PersonMenu } from "./person-menu";
import { AdminModule_Person_TeamMemberships_Card } from "./team-memberships";
import { AdminModule_UpdatePerson_Dialog } from "./update-person";

export function AdminModule_Person_Content({ personId }: { personId: PersonId }) {
    const organization = useOrganization();

    const [{ data: person }, { data: linkedUser }] = useSuspenseQueries({
        queries: [
            trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }),
            trpc.personnel.getLinkedUser.queryOptions({
                organizationId: organization.id,
                personId,
            }),
        ],
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Personnel",
                        href: route("/orgs/[slug]/admin/personnel", { slug: organization.slug }),
                    },
                    person.name,
                ]}
            />
            <Std.ScrollContainer>
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
                                        <Protect permissions={{ person: ["update"] }}>
                                            <AdminModule_UpdatePerson_Dialog person={person} />
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
                                            <DLDetails className="font-mono">
                                                {linkedUser.userId}
                                            </DLDetails>
                                            <DLTerm>Name</DLTerm>
                                            <DLDetails>{linkedUser.name}</DLDetails>
                                            <DLTerm>Email</DLTerm>
                                            <DLDetails>{linkedUser.email}</DLDetails>
                                            <DLTerm>Roles</DLTerm>
                                            <DLDetails>
                                                {linkedUser.roles
                                                    .map(
                                                        (role) =>
                                                            OrganizationRole.displayNames[role],
                                                    )
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
            </Std.ScrollContainer>
        </>
    );
}
