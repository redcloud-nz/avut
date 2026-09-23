/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/verify-email
 */

import { Suspense } from "react";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { VerifyEmail_Card } from "@/components/auth/verify-email";
import { Argus } from "@/components/blocks/argus";
import { safeRedirectPath } from "@/lib/auth-redirect";

export const metadata = { title: "Verify Email" };

// Not `async` — see the note in /auth/sign-in/page.tsx. Here it's `params` and `searchParams`,
// but it's the same class of URL read and the same fix.
export default function Auth_VerifyEmail_Page(props: PageProps<"/auth/verify-email/[email]">) {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column>
                <Suspense fallback={<AuthCard_Skeleton fields={0} />}>
                    <VerifyEmail_CardFromParams
                        params={props.params}
                        searchParams={props.searchParams}
                    />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}

async function VerifyEmail_CardFromParams({
    params,
    searchParams,
}: {
    params: PageProps<"/auth/verify-email/[email]">["params"];
    searchParams: PageProps<"/auth/verify-email/[email]">["searchParams"];
}) {
    const { email } = await params;
    const query = await searchParams;
    const redirectTo = Array.isArray(query.redirectTo) ? query.redirectTo[0] : query.redirectTo;

    return (
        <VerifyEmail_Card
            email={decodeURIComponent(email)}
            redirectTo={safeRedirectPath(redirectTo) ?? undefined}
        />
    );
}
