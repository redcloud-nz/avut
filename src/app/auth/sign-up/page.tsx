/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/sign-up
 */

import { Argus } from "@/components/blocks/argus";

import { SignUp_Card } from "@/components/cards/sign-up";

export const metadata = { title: "Sign Up" };

export default function Auth_SignUp_Page(props: PageProps<"/auth/sign-up">) {
    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <SignUp_Card />
                <Argus.Footer>
                    By clicking continue, you agree to our{" "}
                    <a href="/terms-of-service" target="_blank">
                        Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy-policy" target="_blank">
                        Privacy Policy
                    </a>
                    .
                </Argus.Footer>
            </Argus.Column>
        </Argus.Root>
    );
}
