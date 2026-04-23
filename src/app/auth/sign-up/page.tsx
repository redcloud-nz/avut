/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-up
 */

import Link from "next/link";

import { Argus } from "@/components/blocks/argus";

import { SignUp_Card } from "@/components/cards/sign-up";

export const metadata = { title: "Sign Up" };

export default async function Auth_SignUp_Page(props: PageProps<"/auth/sign-up">) {
    const params = await props.searchParams;
    const email = Array.isArray(params.email) ? params.email[0] : params.email;

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <SignUp_Card email={email ? decodeURIComponent(email) : undefined} />
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
