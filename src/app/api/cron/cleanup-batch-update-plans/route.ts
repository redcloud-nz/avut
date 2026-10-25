/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /api/cron/cleanup-batch-update-plans
 *
 * The daily batch-update-plan cleanup, scheduled in `vercel.json`. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; anything else — including every request while
 * `CRON_SECRET` is unset — is refused. Not auth-gated by the app (the proxy matcher excludes
 * `/api`), so the secret is the whole guard.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { cleanupBatchUpdatePlans } from "@/server/cron/cleanup-batch-update-plans";
import { serverEnv } from "@/server/env";

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

    const result = await cleanupBatchUpdatePlans();
    return NextResponse.json(result, { status: 200 });
}
