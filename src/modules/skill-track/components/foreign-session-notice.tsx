/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { Route } from "next";
import Link from "next/link";

import { Protect } from "@/components/protect";
import type { TeamRef } from "@/lib/schemas/team";

/**
 * The one-line notice under a foreign session's title in team scope (`useSessionAccess`): whose
 * session it is, that it's view only here, and, for anyone who can enter the org scope, a link to
 * the same page there (`orgHref`), where it can be changed.
 */
export function SkillTrack_ForeignSessionNotice({
    team,
    orgHref,
}: {
    /** The team the session belongs to, or `null` for an org session. */
    team: TeamRef | null;
    orgHref: Route;
}) {
    return (
        <p className="text-sm text-muted-foreground">
            This session belongs to {team ? team.name : "the organisation"}. View only here.{" "}
            <Protect permissions={{ organization: ["view"] }}>
                <Link href={orgHref} className="underline underline-offset-4 hover:text-foreground">
                    Open it in the organisation
                </Link>
            </Protect>
        </p>
    );
}
