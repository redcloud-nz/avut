/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/server/env";

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Whether a request to a `/api/cron/*` route carries `Authorization: Bearer $CRON_SECRET`, as
 * Vercel Cron sends it. Every request is refused while `CRON_SECRET` is unset. The cron routes
 * aren't auth-gated by the app (the proxy matcher excludes `/api`), so this is their whole guard.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
    const secret = serverEnv.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    return !!secret && !!authorization && safeCompare(authorization, `Bearer ${secret}`);
}
