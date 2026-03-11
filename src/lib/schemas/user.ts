/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { User as UserRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export const UserId = {
    schema: zodNanoId16("UserId expected").brand<"UserId">(),

    create: (): UserId => UserId.schema.parse(nanoId16()),
} as const;

export type UserId = string & z.BRAND<"UserId">;

const userSchema = z.object({
    id: UserId.schema,
    email: z.email(),
    emailVerified: z.boolean().default(false),
    name: z.string().max(100),
    image: z.url().nullable(),
});

export const UserData = {
    schema: userSchema,

    fromRecord: (
        record: Pick<UserRecord, "id" | "name" | "email" | "image">,
    ): UserData =>
        userSchema.parse({
            ...record,
        }),
} as const;

export type UserData = z.infer<typeof userSchema>;
