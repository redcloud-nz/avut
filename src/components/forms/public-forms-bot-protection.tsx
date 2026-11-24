/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { initBotId } from "botid/client/core";
import { useEffect } from "react";

import { PUBLIC_FORM_BOT_PROTECTED_PATHS } from "@/lib/public-forms";

/** `initBotId` patches `fetch` for the whole page: once is enough, and twice would double it. */
let started = false;

/**
 * Vercel BotID for the public forms: tags their submit requests so the server's `checkBotId()`
 * can judge them (`src/trpc/routers/public-forms-router.ts`). Mounted by the `/forms` layout
 * only, so BotID's challenge script loads on these pages and not across the app. Skipped in
 * development by BotID itself.
 */
export function PublicForms_BotProtection() {
    useEffect(() => {
        if (started) return;
        started = true;
        initBotId({ protect: [...PUBLIC_FORM_BOT_PROTECTED_PATHS] });
    }, []);
    return null;
}
