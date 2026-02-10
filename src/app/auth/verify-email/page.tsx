/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/verify-email
 */

import { Argus } from "@/components/blocks/argus";

import { VerifyEmail_Card } from "@/components/cards/verify-email";

export const metadata = { title: "Verify Email" };

export default async function Auth_VerifyEmail_Page(
    props: PageProps<"/auth/verify-email">,
) {
    const params = await props.searchParams;
    const email = Array.isArray(params.e) ? params.e[0] : params.e || "";

    // Extract redirect parameter from the URL search parameters
    let redirect = Array.isArray(params.r) ? params.r[0] : params.r;

    if (redirect) redirect = decodeURIComponent(redirect);

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <VerifyEmail_Card email={email} redirect={redirect} />
            </Argus.Column>
        </Argus.Root>
    );
}
