/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /invitations/[invitation_id]
 */

import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { Argus } from "@/components/blocks/argus";
import { InvitationLanding_Card } from "@/components/invitations/invitation-landing";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { getSession, isAccountClosed } from "@/server/session";
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

    // A closed account can't accept anything until it's restored — send it to that screen
    // rather than letting Accept fail.
    const session = await getSession();
    if (session && isAccountClosed(session)) redirect("/auth/account-closed");

    prefetch(trpc.invitations.getLanding.queryOptions({ invitationId: parsed.data }));

    return (
        <HydrateClient>
            <InvitationLanding_Card invitationId={parsed.data} />
        </HydrateClient>
    );
}
