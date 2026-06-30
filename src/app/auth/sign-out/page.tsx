/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-out
 */

import { Argus } from "@/components/blocks/argus";

import { SignOut } from "@/components/auth/sign-out";

export const metadata = { title: "Sign Out" };

export default async function SignOut_Page() {
    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <SignOut />
            </Argus.Column>
        </Argus.Root>
    );
}
