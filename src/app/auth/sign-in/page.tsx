/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-in
 */

import { Argus } from "@/components/blocks/argus";

import { SignIn_Card } from "@/components/cards/sign-in";

export const metadata = { title: "Sign In" };

export default function SignInPage() {
    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <SignIn_Card />
            </Argus.Column>
        </Argus.Root>
    );
}
