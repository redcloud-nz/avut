/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/verify-email
 */

import { Argus } from "@/components/blocks/argus";

import { VerifyEmail_Card } from "@/components/auth/verify-email";

export const metadata = { title: "Verify Email" };

export default async function Auth_VerifyEmail_Page(
    props: PageProps<"/auth/verify-email/[email]">,
) {
    const { email } = await props.params;

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <VerifyEmail_Card email={decodeURIComponent(email)} />
            </Argus.Column>
        </Argus.Root>
    );
}
