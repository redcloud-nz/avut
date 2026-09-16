/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user
 */

import { Suspense } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityStats_Card } from "@/components/user/activity-stats";
import { ActivityStats_Skeleton } from "@/components/user/activity-stats-skeleton";
import { Invitations_Card } from "@/components/user/invitations";
import { OrgSelector_Card } from "@/components/user/org-selector";
import { requireSession } from "@/server/session";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Dashboard`,
};

export default async function UserDashboard_Page() {
    const session = await requireSession();

    prefetch(trpc.users.listMemberships.queryOptions());
    prefetch(trpc.users.listInvitations.queryOptions());
    prefetch(trpc.users.getActivityStats.queryOptions());

    return (
        <HydrateClient>
            <Std.Navbar breadcrumbs={["Dashboard"]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>User Dashboard</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardContent className="flex gap-2">
                            <div className="font-medium pr-2">Signed in as</div>
                            <div>{session.user.name}</div>
                            <div className="text-muted-foreground">{session.user.email}</div>
                        </CardContent>
                    </Card>
                    <Saratoga.Columns variant="1-1">
                        <Saratoga.Column slot="main">
                            <OrgSelector_Card session={session} />
                            <Invitations_Card />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Suspense fallback={<ActivityStats_Skeleton />}>
                                <ActivityStats_Card />
                            </Suspense>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
