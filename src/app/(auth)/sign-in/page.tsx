/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /sign-in
 */

import { Argus } from "@/components/blocks/argus";

import { Auth_SignIn_Card } from "./sign-in";

export const metadata = { title: "Sign In" };

export default function SignInPage() {
    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <Auth_SignIn_Card />
            </Argus.Column>
        </Argus.Root>
    );
}
