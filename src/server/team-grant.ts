/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cache } from "react";

import type { PrismaClient } from "@/generated/prisma/client";
import type { TeamScopeTeamData } from "@/lib/schemas/team-scope";
import type { UserId } from "@/lib/schemas/user";

import * as Teams from "./services/teams";

/**
 * `Teams.getGrantedBySlug`, deduplicated per server request with React `cache`, so the team layout
 * (`requireTeam`), its `generateMetadata` (`getGrantedTeam`) and every `teamProcedure` call in the
 * same render share one grant query.
 *
 * The key is the arguments themselves: the slug and user id by value, and the client by identity.
 * In a request that's the one `@/server/prisma` singleton both `team-access.ts` and the tRPC
 * context pass, so the key is in effect `(slug, userId)`. Taking the client as an argument rather
 * than importing the singleton keeps `teamProcedure` on `ctx.prisma`, which tests inject.
 *
 * Outside a React server render (the `/trpc` HTTP handler, tests) `cache` is a passthrough, so
 * each call queries.
 */
export const getGrantedTeamCached = cache(
    (prisma: PrismaClient, slug: string, userId: UserId): Promise<TeamScopeTeamData | null> =>
        Teams.getGrantedBySlug(prisma, slug, userId),
);
