/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/forgot-password
 */

import { Argus } from "@/components/blocks/argus";
import { Auth_ForgotPassword_Card } from "@/components/cards/forgot-password";

export const metadata = { title: "Forgot Password" };

export default function Auth_ForgotPassword_Page() {
    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <Auth_ForgotPassword_Card />
            </Argus.Column>
        </Argus.Root>
    );
}
