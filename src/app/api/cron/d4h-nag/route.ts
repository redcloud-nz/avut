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

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { runD4HNagDue } from "@/server/cron/d4h-nag";
import { serverEnv } from "@/server/env";

/**
 * Every organization's sends share this one invocation, at least 500 ms apart (decision 16). A
 * run cut off by the limit is failed by the next tick's stuck-run cleanup.
 */
export const maxDuration = 300;

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(request: Request): Promise<NextResponse> {
    const secret = serverEnv.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!secret || !authorization || !safeCompare(authorization, `Bearer ${secret}`)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runD4HNagDue();

    const failed = result.organizations.some((r) => r.outcome === "failed");
    if (failed) console.error("D4H attendance reminder tick had failures:", JSON.stringify(result));

    return NextResponse.json(result, { status: failed ? 500 : 200 });
}
