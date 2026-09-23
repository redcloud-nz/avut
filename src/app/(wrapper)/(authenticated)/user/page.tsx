/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user
 */

import { Suspense } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ActivityStats_Card, ActivityStats_Skeleton } from "@/components/user/activity-stats";
import { Invitations_Card, Invitations_Skeleton } from "@/components/user/invitations";
import { OrgSelector_Card, OrgSelector_Skeleton } from "@/components/user/org-selector";
import { SignedInAs_Card, SignedInAs_Skeleton } from "@/components/user/signed-in-as";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Dashboard`,
};

export default function UserDashboard_Page() {
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
                    <Suspense fallback={<SignedInAs_Skeleton />}>
                        <SignedInAs_Card />
                    </Suspense>
                    <Saratoga.Columns variant="1-1">
                        <Saratoga.Column slot="main">
                            <Suspense fallback={<OrgSelector_Skeleton />}>
                                <OrgSelector_Card />
                            </Suspense>
                            <Suspense fallback={<Invitations_Skeleton />}>
                                <Invitations_Card />
                            </Suspense>
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
