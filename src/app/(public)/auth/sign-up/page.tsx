/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-up
 */

import { Suspense } from "react";

import Link from "next/link";

import { Argus } from "@/components/blocks/argus";

import { AuthCard_Skeleton } from "@/components/auth/auth-card-skeleton";
import { SignUp_Card } from "@/components/auth/sign-up";

export const metadata = { title: "Sign Up" };

// Not `async` — see the note in /auth/sign-in/page.tsx.
export default function Auth_SignUp_Page(props: PageProps<"/auth/sign-up">) {
    return (
        <Argus.Root>
            <Argus.Column>
                <Suspense fallback={<AuthCard_Skeleton fields={3} />}>
                    <SignUp_CardFromParams searchParams={props.searchParams} />
                </Suspense>
                <Argus.Footer>
                    By clicking continue, you agree to our{" "}
                    <Link href="/policies/terms-of-service" target="_blank">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/policies/privacy" target="_blank">
                        Privacy Policy
                    </Link>
                    .
                </Argus.Footer>
            </Argus.Column>
        </Argus.Root>
    );
}

async function SignUp_CardFromParams({
    searchParams,
}: {
    searchParams: PageProps<"/auth/sign-up">["searchParams"];
}) {
    const params = await searchParams;
    const email = Array.isArray(params.email) ? params.email[0] : params.email;

    return <SignUp_Card email={email ? decodeURIComponent(email) : undefined} />;
}
