/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-out
 */

import { Suspense } from "react";

import { SignOut } from "@/components/auth/sign-out";
import { Argus } from "@/components/blocks/argus";
import { RainbowSpinner } from "@/components/ui/loading";

export const metadata = { title: "Sign Out" };

export default async function SignOut_Page() {
    return (
        <Argus.Root fullHeight={false}>
            <Argus.Column>
                {/* `SignOut` reads `?redirectTo=` with `useSearchParams`. */}
                <Suspense fallback={<RainbowSpinner />}>
                    <SignOut />
                </Suspense>
            </Argus.Column>
        </Argus.Root>
    );
}
