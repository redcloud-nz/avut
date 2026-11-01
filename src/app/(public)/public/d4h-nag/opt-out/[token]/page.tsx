/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /public/d4h-nag/opt-out/[token]
 */

import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { Argus } from "@/components/blocks/argus";
import { OptOut_Card, OptOutLinkInvalid_Card } from "@/components/d4h-nag-opt-out/opt-out-card";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// The URL carries a secret link token: keep it out of search indexes, and out of the Referer
// header of anything the page links to.
export const metadata: Metadata = {
    title: "Attendance reminders",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
};

/** The router's `linkTokenSchema` bound; a longer token can't name a recipient. */
const MAX_TOKEN_LENGTH = 200;

// Not `async` — see the note in /auth/sign-in/page.tsx.
export default function D4HNagOptOut_Page(props: PageProps<"/public/d4h-nag/opt-out/[token]">) {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column width="md">
                <Suspense fallback={<AuthCard_Skeleton fields={0} />}>
                    <OptOut_CardFromParams params={props.params} />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}

async function OptOut_CardFromParams({
    params,
}: {
    params: PageProps<"/public/d4h-nag/opt-out/[token]">["params"];
}) {
    const { token } = await params;

    // Access is by the token alone, through the public procedures. A token the procedure's
    // input would reject can never match, so it gets the same answer as an unknown one.
    if (token.length > MAX_TOKEN_LENGTH) return <OptOutLinkInvalid_Card />;

    // Read only: the page's GET never changes state, since email link scanners open every URL.
    prefetch(trpc.d4hNag.getOptOutByToken.queryOptions({ token }));

    return (
        <HydrateClient>
            <OptOut_Card token={token} />
        </HydrateClient>
    );
}
