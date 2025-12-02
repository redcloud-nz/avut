import { Argus } from "@/components/blocks/argus";

/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/reset-password/[email]
 */

export const metadata = { title: "Reset Password" };

export default async function Auth_ResetPassword_Page(
    page: PageProps<"/auth/reset-password/[email]">,
) {
    const { email } = await page.params;

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
            </Argus.Column>
        </Argus.Root>
    );
}
