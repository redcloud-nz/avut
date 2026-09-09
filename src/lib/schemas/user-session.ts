/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { Session as SessionRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export const UserSessionId = {
    schema: zodNanoId16("UserSessionId expected").brand<"UserSessionId">(),

    create: (): UserSessionId => UserSessionId.schema.parse(nanoId16()),
} as const;

export type UserSessionId = string & z.BRAND<"UserSessionId">;

/**
 * One of the current user's active sessions, as shown in security settings.
 *
 * Deliberately carries no `token`: a session token is a bearer credential, and the browser
 * has no need of anyone's but its own. Revocation is by `id`, with the server resolving the
 * token — so an XSS on this page can't harvest the user's other devices.
 */
const userSessionSchema = z.object({
    id: UserSessionId.schema,
    createdAt: z.date(),
    userAgent: z.string().nullable(),
    /** Whether this is the session making the request. Decided server-side. */
    isCurrent: z.boolean(),
});

export const UserSessionData = {
    schema: userSessionSchema,

    fromRecord: (
        record: Pick<SessionRecord, "id" | "createdAt" | "userAgent">,
        isCurrent: boolean,
    ): UserSessionData => userSessionSchema.parse({ ...record, isCurrent }),
} as const;

export type UserSessionData = z.infer<typeof userSessionSchema>;
