/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

"use client";

import { Argus } from "@/components/blocks/argus";
import { Button } from "@/components/ui/button";
import { CopyrightString } from "@/components/ui/copyright";
import { Link } from "@/components/ui/link";
import * as Paths from "@/paths";

import { authClient } from "@/lib/auth-client";

export default function HomePage() {
    const session = authClient.useSession();

    return (
        <Argus.Root>
            <Argus.Column className="gap-8">
                <Argus.AppLogo />
                <div className="flex items-center justify-center gap-2">
                    {session ? (
                        <>
                            <Button asChild>
                                <Link to={Paths.orgs.selectAuto}>
                                    Go to Dashboard
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button asChild>
                                <Link to={Paths.auth.signIn()}>Sign In</Link>
                            </Button>
                            <Button asChild>
                                <Link to={Paths.auth.signUp()}>Sign Up</Link>
                            </Button>
                        </>
                    )}
                </div>
                <p className="text-center text-muted-foreground text-sm">
                    <CopyrightString />
                </p>
            </Argus.Column>
        </Argus.Root>
    );
}
