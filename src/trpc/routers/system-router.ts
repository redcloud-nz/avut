/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createTrpcRouter, systemAdminProcedure } from "../init";

/**
 * Site-wide system router. Gated by `systemAdminProcedure` (`session.user.role === "admin"`),
 * not by org-scoped permissions. Most of what used to live here (user-account moderation,
 * site-wide organization admin, skill-package import) has moved into the relevant domain
 * routers (`users`, `organizations`, `skillPackageBuilder`) — this router stays for whatever
 * genuinely has no domain home.
 */
export const systemRouter = createTrpcRouter({
    health: systemAdminProcedure.query(() => ({ ok: true as const })),
});
