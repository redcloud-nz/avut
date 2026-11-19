/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { RecordInfo_Card } from "@/components/cards/record-info-card";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardLoadingFallback } from "@/components/ui/card";
import {
    DataItem,
    DataItemAction,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { AdminModule_Person_LinkedUser_Card } from "@/modules/org-admin/components/personnel/linked-user-card";
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
                actions={<HelpButton id="admin/personnel" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title
                            badges={
                                person.status !== "Active" && (
                                    <Badge variant="outline">{person.status}</Badge>
                                )
                            }
                        >
                            {person.name}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_PersonMenu person={person} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem>
                                            <DataItemTitle>Email</DataItemTitle>
                                            <DataItemValue>{person.email}</DataItemValue>
                                            <DataItemAction className="-my-1">
                                                <Protect permissions={{ person: ["update"] }}>
                                                    <AdminModule_UpdatePerson_Dialog
                                                        person={person}
                                                    />
                                                </Protect>
                                            </DataItemAction>
                                        </DataItem>
                                    </DataList>
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
                            <RecordInfo_Card
                                id={person.id}
                                idLabel="Person ID"
                                createdAt={person.createdAt}
                                updatedAt={person.updatedAt}
                            />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
