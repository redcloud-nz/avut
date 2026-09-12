/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/reset-password/[email]
 */

import { Suspense } from "react";

import { Argus } from "@/components/blocks/argus";
import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { ResetPassword_Card } from "@/components/auth/reset-password";

export const metadata = { title: "Reset Password" };

// Not `async` — see the note in /auth/sign-in/page.tsx.
export default function Auth_ResetPassword_Page(props: PageProps<"/auth/reset-password">) {
    return (
        <Argus.Root>
            <Argus.Column className="max-w-xs">
                <Suspense fallback={<AuthCard_Skeleton fields={2} />}>
                    <ResetPassword_CardFromParams searchParams={props.searchParams} />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}

async function ResetPassword_CardFromParams({
    searchParams,
}: {
    searchParams: PageProps<"/auth/reset-password">["searchParams"];
}) {
    const params = await searchParams;
    const email = Array.isArray(params.e) ? params.e[0] : params.e || "";

    return <ResetPassword_Card email={email} />;
}
