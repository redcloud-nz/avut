/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /api/cron/d4h-nag
 *
 * The hourly D4H attendance reminder dispatcher (#445), scheduled in `vercel.json`. Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`; anything else — including every request while
 * `CRON_SECRET` is unset — is refused. Not auth-gated by the app (the proxy matcher excludes
 * `/api`), so the secret is the whole guard.
 */

import { NextResponse } from "next/server";

import { isModuleUsable } from "@/lib/module-flags";
import { isAuthorizedCronRequest } from "@/server/cron/authorize";
import { runD4HNagDue } from "@/server/cron/d4h-nag";
import { resolveModuleFlags } from "@/server/module-flags";

/**
 * Every organization's sends share this one invocation, at least 500 ms apart (decision 16). A
 * run cut off by the limit is failed by the next tick's stuck-run cleanup.
 */
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
    if (!isAuthorizedCronRequest(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The Vercel flag is per deployment, so it's evaluated once per tick (decision 27). Off, the
    // tick does nothing at all: no sends, no stuck-run cleanup, no pruning. The settings are
    // passed as all on, so only the flags of the module and the modules it requires are read;
    // each organization's settings are checked by the runner.
    const moduleFlags = await resolveModuleFlags();
    if (!isModuleUsable(moduleFlags, "d4h-nag", () => true)) {
        console.log("D4H attendance reminder tick skipped: the d4h-nag-module flag is off.");
        return NextResponse.json({ skipped: "flag-off" }, { status: 200 });
    }

    const result = await runD4HNagDue();

    // An org that couldn't be processed, or a run that failed inside it, fails the tick, as a
    // per-item failure does in `purge-rubbish`.
    const failed = result.organizations.some(
        (r) =>
            r.outcome === "failed" ||
            (r.outcome === "ran" && r.runs.some((run) => run.status === "Failed")),
    );
    if (failed) console.error("D4H attendance reminder tick had failures:", JSON.stringify(result));

    return NextResponse.json(result, { status: failed ? 500 : 200 });
}
