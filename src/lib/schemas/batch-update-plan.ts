/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type {
    BatchUpdatePlan as BatchUpdatePlanRecord,
    BatchUpdatePlanStatus as BatchUpdatePlanStatusRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export type { BatchUpdatePlanRecord };

export const BatchUpdatePlanId = {
    schema: zodNanoId16("BatchUpdatePlanId expected").brand<"BatchUpdatePlanId">(),

    create: (): BatchUpdatePlanId => BatchUpdatePlanId.schema.parse(nanoId16()),
};

export type BatchUpdatePlanId = string & z.BRAND<"BatchUpdatePlanId">;

/**
 * A plan's lifecycle: `Pending → Executing → Completed | Failed`, plus `Superseded`. There's no
 * expired status: cleanup deletes expired plans, and claiming refuses a `Pending` plan past its TTL.
 */
export const BatchUpdatePlanStatus = {
    schema: z.enum(["Pending", "Executing", "Completed", "Failed", "Superseded"]),
} as const;

export type BatchUpdatePlanStatus = z.infer<typeof BatchUpdatePlanStatus.schema>;

// Fails to compile if the Zod enum and the Prisma enum drift apart, in either direction.
type _StatusMatchesPrisma = [
    AssertTrue<BatchUpdatePlanStatus extends BatchUpdatePlanStatusRecord ? true : false>,
    AssertTrue<BatchUpdatePlanStatusRecord extends BatchUpdatePlanStatus ? true : false>,
];
type AssertTrue<T extends true> = T;
