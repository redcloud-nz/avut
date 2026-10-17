/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { OrganizationGroupId } from "@/lib/schemas/organization-group";
import { trpc } from "@/trpc/client";

import { SystemAdmin_DeleteGroup_Dialog } from "./delete-group-dialog";
import { SystemAdmin_EditGroup_Dialog } from "./edit-group-dialog";

export function SystemAdmin_Group_Content({ groupId }: { groupId: OrganizationGroupId }) {
    const { data: group } = useSuspenseQuery(
        trpc.organizationGroups.getGroup.queryOptions({ groupId }),
    );

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system/admin" },
                    { label: "Groups", href: "/system/admin/groups" },
                    { label: group.name },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{group.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SystemAdmin_EditGroup_Dialog group={group} />
                            <Button
                                variant="outline"
                                onClick={() => void setAction("delete", { history: "push" })}
                            >
                                <ObjectIcons.Delete />
                                <span className="hidden md:inline">Delete</span>
                            </Button>
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Identity</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Group ID</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {group.id}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{group.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Slug</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {group.slug}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={group.createdAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>

            <SystemAdmin_DeleteGroup_Dialog
                group={group}
                open={action === "delete"}
                onOpenChange={(open) =>
                    void setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
