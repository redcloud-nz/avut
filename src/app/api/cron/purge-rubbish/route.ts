/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /api/cron/purge-rubbish
 *
 * The daily Rubbish bin auto-purge (#298), scheduled in `vercel.json`. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; anything else — including every request while
 * `CRON_SECRET` is unset — is refused. Not auth-gated by the app (the proxy matcher excludes
 * `/api`), so the secret is the whole guard.
 */

import { NextResponse } from "next/server";

import { purgeRubbish } from "@/server/cron/purge-rubbish";
import { serverEnv } from "@/server/env";

export async function GET(request: Request): Promise<NextResponse> {
    const secret = serverEnv.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await purgeRubbish();

    const failed = results.some((r) => r.error || (r.summary?.failed.length ?? 0) > 0);
    if (failed) console.error("Rubbish bin auto-purge had failures:", JSON.stringify(results));

    return NextResponse.json({ results }, { status: failed ? 500 : 200 });
}
