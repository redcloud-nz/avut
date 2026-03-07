/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

import { getSessionCookie } from "better-auth/cookies";
import { getTranslations } from "next-intl/server";

import { headers as nextHeaders } from "next/headers";

import { Argus } from "@/components/blocks/argus";
import { Button } from "@/components/ui/button";
import { CopyrightString } from "@/components/ui/copyright";
import { Link } from "@/components/ui/link";
import * as Paths from "@/paths";

export default async function HomePage() {
    const headers = await nextHeaders();
    const hasSession = getSessionCookie(headers) != null;

    const t = await getTranslations("HomePage");

    return (
        <Argus.Root>
            <Argus.Column className="gap-8">
                <Argus.AppLogo />
                <div className="flex items-center justify-center gap-2">
                    {hasSession ? (
                        <>
                            <Button asChild>
                                <Link to={Paths.orgs.selectAuto}>
                                    {t("enterButton")}
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button asChild>
                                <Link to={Paths.auth.signIn()}>
                                    {t("signInButton")}
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link to={Paths.auth.signUp()}>
                                    {t("signUpButton")}
                                </Link>
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
