/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/reset-password/[email]
 */

import { Argus } from "@/components/blocks/argus";
import { ResetPassword_Card } from "@/components/auth/reset-password";

export const metadata = { title: "Reset Password" };

export default async function Auth_ResetPassword_Page(props: PageProps<"/auth/reset-password">) {
    const params = await props.searchParams;

    const email = Array.isArray(params.e) ? params.e[0] : params.e || "";

    return (
        <Argus.Root>
            <Argus.Column className="max-w-xs">
                <Argus.AppLogo />
                <ResetPassword_Card email={email} />
            </Argus.Column>
        </Argus.Root>
    );
}
