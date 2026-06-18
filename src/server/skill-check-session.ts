/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";

import { OrganizationId } from "@/lib/schemas/organization";
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

import prisma from "./prisma";

/**
 * Get a skill check session by its ID within an organization.
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `skill-check-session-{sessionId}`.
 * - The `sessionId` parameter is not typed to allow easier integration with route parameters.
 * - If the session is not found, null is returned.
 *
 * @param organizationId The ID of the organization.
 * @param sessionId The ID of the skill check session.
 * @returns The skill check session data, or null if not found.
 */
export async function getSkillCheckSessionById(
    organizationId: OrganizationId,
    sessionId: string,
): Promise<SkillCheckSession | null> {
    "use cache";
    cacheTag(`skill-check-session-${sessionId}`);

    const session = await prisma.skillCheckSession.findUnique({
        where: { organizationId, id: sessionId },
    });

    return session ? SkillCheckSession.fromRecord(session) : null;
}

/**
 * Revalidate the cache for a skill check session.
 * @param sessionId The ID of the skill check session.
 */
export async function revalidateSkillCheckSession(sessionId: SkillCheckSessionId) {
    revalidateTag(`skill-check-session-${sessionId}`, { expire: 0 });
}
