/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /invitations/[invitation_id]
 */

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Argus } from "@/components/blocks/argus";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { InvitationLanding_Card } from "@/components/invitations/invitation-landing";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = { title: "Invitation" };

// Not `async` — see the note in /auth/sign-in/page.tsx.
export default function Invitation_Page(props: PageProps<"/invitations/[invitation_id]">) {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column width="md">
                <Suspense fallback={<AuthCard_Skeleton fields={0} />}>
                    <Invitation_LandingFromParams params={props.params} />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}

async function Invitation_LandingFromParams({
    params,
}: {
    params: PageProps<"/invitations/[invitation_id]">["params"];
}) {
    const { invitation_id } = await params;

    // A malformed id can never name an invitation, so it is a plain 404 rather than a
    // "not found" card.
    const parsed = InvitationId.schema.safeParse(invitation_id);
    if (!parsed.success) notFound();

    prefetch(trpc.invitations.getLanding.queryOptions({ invitationId: parsed.data }));

    return (
        <HydrateClient>
            <InvitationLanding_Card invitationId={parsed.data} />
        </HydrateClient>
    );
}
