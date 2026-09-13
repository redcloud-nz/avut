/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-in
 */

import { Suspense } from "react";

import { Argus } from "@/components/blocks/argus";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { SignIn_Card } from "@/components/auth/sign-in";
import { safeRedirectPath } from "@/lib/auth-redirect";

export const metadata = { title: "Sign In" };

// Not `async`: the `searchParams` promise is handed to the child unawaited so the shell around
// it prerenders. Awaiting here would make the whole route block. See auth-card-skeleton.tsx.
export default function SignIn_Page(props: PageProps<"/auth/sign-in">) {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column>
                <Suspense fallback={<AuthCard_Skeleton fields={2} />}>
                    <SignIn_CardFromParams searchParams={props.searchParams} />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}

async function SignIn_CardFromParams({
    searchParams,
}: {
    searchParams: PageProps<"/auth/sign-in">["searchParams"];
}) {
    const params = await searchParams;
    const email = Array.isArray(params.email) ? params.email[0] : params.email;
    const redirectTo = Array.isArray(params.redirectTo) ? params.redirectTo[0] : params.redirectTo;

    return (
        <SignIn_Card
            email={email ? decodeURIComponent(email) : undefined}
            redirectTo={safeRedirectPath(redirectTo) ?? undefined}
        />
    );
}
