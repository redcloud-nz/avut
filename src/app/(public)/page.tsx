/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

import { getSessionCookie } from "better-auth/cookies";
import Link from "next/link";

import { headers as nextHeaders } from "next/headers";

import { Argus } from "@/components/blocks/argus";
import { Button } from "@/components/ui/button";
import { CopyrightString } from "@/components/ui/copyright";

export default async function HomePage() {
    const headers = await nextHeaders();
    const hasSession = getSessionCookie(headers) != null;

    return (
        <Argus.Root>
            <Argus.Column className="gap-8">
                <Argus.AppLogo />
                <div className="flex items-center justify-center gap-2">
                    {hasSession ? (
                        <>
                            <Button asChild>
                                <Link href="/main/--select-org">Enter</Link>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button asChild>
                                <Link href="/auth/sign-in">Sign In</Link>
                            </Button>
                            <Button asChild>
                                <Link href="/auth/sign-up">Sign Up</Link>
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
