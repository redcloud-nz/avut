/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

/**
 * The person detail page's "Linked User Account" card — its own `getLinkedUser` fetch, decoupled
 * from the rest of the page so a caller without `member: ["view"]` never issues it (the
 * procedure itself requires `member: ["view"], person: ["view"]`, so a plain `person: ["view"]`
 * holder would otherwise get a silent `FORBIDDEN` on a query it can't use). Rendered only inside
 * a `<Protect permissions={{ member: ["view"] }}>` by the caller.
 */
export function AdminModule_Person_LinkedUser_Card({ personId }: { personId: PersonId }) {
    const organization = useOrganization();

    const { data: linkedUser } = useSuspenseQuery(
        trpc.personnel.getLinkedUser.queryOptions({ organizationId: organization.id, personId }),
    );

    if (!linkedUser) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Linked User Account</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>User ID</DataItemTitle>
                        <DataItemValue className="font-mono">
                            <Link
                                href={route("/orgs/[slug]/admin/users/[user_id]", {
                                    slug: organization.slug,
                                    user_id: linkedUser.userId,
                                })}
                            >
                                {linkedUser.userId}
                            </Link>
                        </DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Name</DataItemTitle>
                        <DataItemValue>{linkedUser.user.name}</DataItemValue>
                    </DataItem>
                    <DataItem>
                        <DataItemTitle>Email</DataItemTitle>
                        <DataItemValue>{linkedUser.user.email}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Roles</DataItemTitle>
                        <DataItemValue>
                            {linkedUser.roles
                                .map((role) => OrganizationRole.displayNames[role])
                                .join(", ")}
                        </DataItemValue>
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}
