/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/forgot-password
 */

import { Suspense } from "react";

import { Argus } from "@/components/blocks/argus";
import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { Auth_ForgotPassword_Card } from "@/components/auth/forgot-password";
import { safeRedirectPath } from "@/lib/auth-redirect";

export const metadata = { title: "Forgot Password" };

// Not `async`: the `searchParams` promise is handed to the child unawaited so the shell around
// it prerenders. See /auth/sign-in/page.tsx.
export default function Auth_ForgotPassword_Page(props: PageProps<"/auth/forgot-password">) {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column>
                <Suspense fallback={<AuthCard_Skeleton fields={1} />}>
                    <ForgotPassword_CardFromParams searchParams={props.searchParams} />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}

async function ForgotPassword_CardFromParams({
    searchParams,
}: {
    searchParams: PageProps<"/auth/forgot-password">["searchParams"];
}) {
    const params = await searchParams;
    const email = Array.isArray(params.email) ? params.email[0] : params.email;
    const redirectTo = Array.isArray(params.redirectTo) ? params.redirectTo[0] : params.redirectTo;

    return (
        <Auth_ForgotPassword_Card
            email={email || undefined}
            redirectTo={safeRedirectPath(redirectTo) ?? undefined}
        />
    );
}
