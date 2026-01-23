/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-in
 */

import { Argus } from "@/components/blocks/argus";

import { SignIn_Card } from "@/components/cards/sign-in";

export const metadata = { title: "Sign In" };

export default async function SignIn_Page(props: PageProps<"/auth/sign-in">) {
    const searchParams = await props.searchParams;

    // Extract redirect parameter from the URL search parameters
    let redirect = Array.isArray(searchParams.r)
        ? searchParams.r[0]
        : searchParams.r;

    if (redirect) redirect = decodeURIComponent(redirect);

    // Only allow absolute paths for redirects
    if (!redirect?.startsWith("/")) redirect = undefined;

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <SignIn_Card redirect={redirect} />
            </Argus.Column>
        </Argus.Root>
    );
}
