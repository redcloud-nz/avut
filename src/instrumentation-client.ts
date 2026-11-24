/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { initBotId } from "botid/client/core";

import { PUBLIC_FORM_BOT_PROTECTED_PATHS } from "@/lib/public-forms";

// Vercel BotID, set up the documented way for Next.js 15.3+. It hooks `fetch` on every page, but
// only loads its challenge script when a protected request is made: a public form submit
// (`src/trpc/routers/public-forms-router.ts` checks it). Skipped in development.
initBotId({ protect: [...PUBLIC_FORM_BOT_PROTECTED_PATHS] });
