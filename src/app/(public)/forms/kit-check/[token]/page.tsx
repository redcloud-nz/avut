/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /forms/kit-check/[token]
 */

import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import {
    SelfAudit_Member,
    SelfAuditLinkInvalid_Card,
} from "@/components/self-audit/self-audit-member";
import { selfAuditTokenSchema } from "@/lib/schemas/self-audit";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// The URL carries a secret link token: keep it out of search indexes, and out of the Referer
// header of anything the page links to.
export const metadata: Metadata = {
    title: "Issued Equipment Self-Audit",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
};

// Not `async` — see the note in /auth/sign-in/page.tsx.
export default function SelfAuditMember_Page(props: PageProps<"/forms/kit-check/[token]">) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
            <Suspense fallback={<AuthCard_Skeleton fields={0} />}>
                <SelfAudit_MemberFromParams params={props.params} />
            </Suspense>
        </div>
    );
}

async function SelfAudit_MemberFromParams({
    params,
}: {
    params: PageProps<"/forms/kit-check/[token]">["params"];
}) {
    const { token } = await params;

    // Access is by the token alone, through the public procedures. A token the procedure's
    // input would reject can never match, so it gets the same answer as an unknown one.
    if (!selfAuditTokenSchema.safeParse(token).success) return <SelfAuditLinkInvalid_Card />;

    // Read only: the page's GET never changes state, since email link scanners open every URL.
    // The client records the open once it mounts.
    prefetch(trpc.publicForms.getSelfAuditByToken.queryOptions({ token }));

    return (
        <HydrateClient>
            <SelfAudit_Member token={token} />
        </HydrateClient>
    );
}
