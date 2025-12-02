/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /verify-email/[email]
 */

import { Argus } from "@/components/blocks/argus";

import { Auth_VerifyEmail_Card } from "../verify-email";

export const metadata = { title: "Verify Email" };

export default async function VerifyEmailPage(
    props: PageProps<"/verify-email/[email]">,
) {
    const { email } = await props.params;

    return (
        <Argus.Root>
            <Argus.Column className="max-w-xs">
                <Argus.AppLogo />
                <Auth_VerifyEmail_Card email={decodeURIComponent(email)} />
            </Argus.Column>
        </Argus.Root>
    );
}
