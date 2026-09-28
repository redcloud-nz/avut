/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { AdminModule_Person_LinkedUser_Card } from "@/components/admin/personnel/linked-user-card";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
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
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_PersonMenu } from "./person-menu";
import { AdminModule_Person_TeamMemberships_Card } from "./team-memberships";
import { AdminModule_UpdatePerson_Dialog } from "./update-person";

export function AdminModule_Person_Content({ personId }: { personId: PersonId }) {
    const organization = useOrganization();

    const { data: person } = useSuspenseQuery(
        trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }),
    );

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
                actions={<HelpButton slug="admin" />}
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
                            <Protect permissions={{ member: ["view"] }}>
                                <Suspense fallback={<CardLoadingFallback />}>
                                    <AdminModule_Person_LinkedUser_Card personId={person.id} />
                                </Suspense>
                            </Protect>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Suspense fallback={<CardLoadingFallback />}>
                                <AdminModule_Person_TeamMemberships_Card person={person} />
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
