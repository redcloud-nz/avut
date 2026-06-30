/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-in
 */

import { Argus } from "@/components/blocks/argus";

import { SignIn_Card } from "@/components/auth/sign-in";

export const metadata = { title: "Sign In" };

export default async function SignIn_Page(props: PageProps<"/auth/sign-in">) {
    const params = await props.searchParams;
    const email = Array.isArray(params.email) ? params.email[0] : params.email;

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <SignIn_Card email={email ? decodeURIComponent(email) : undefined} />
            </Argus.Column>
        </Argus.Root>
    );
}
