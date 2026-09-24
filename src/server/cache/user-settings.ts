/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag } from "next/cache";

import { UserSettings } from "@/lib/schemas/user-settings";
import prisma from "@/server/prisma";
import { readUserSettings } from "@/server/user-settings-store";

import { userSettingsCacheTag } from "./user-settings-revalidate";

export { revalidateUserSettings } from "./user-settings-revalidate";
export { readUserSettings, writeUserSettings } from "@/server/user-settings-store";

/**
 * Get the settings for a given user ID. This function is cached and will revalidate when
 * settings are updated.
 *
 * Keys purely on `userId` — there is no session check here.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
    "use cache";
    cacheTag(userSettingsCacheTag(userId));

    return await readUserSettings(prisma, userId);
}
