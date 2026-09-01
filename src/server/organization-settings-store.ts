/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Read/write access to the `OrganizationConfig` rows backing an organization's settings.
 *
 * Deliberately NOT marked `server-only` and deliberately free of any `@/server/prisma` import —
 * the Prisma client is injected by the caller so this can be used from tRPC routers (which are
 * exercised from the jsdom test environment against `createMockPrisma()`).
 *
 * Everything here keys purely on `organizationId`; there is no session or membership dependency,
 * which is what lets the system-admin router operate on organizations the caller does not belong
 * to.
 */

import * as R from "remeda";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { diffObject, DiffChange } from "@/lib/diff";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

/** The slice of the Prisma client this module needs. */
export type OrganizationSettingsPrisma = Pick<PrismaClient, "organizationConfig" | "$transaction">;

/**
 * Read an organization's settings straight from the database (uncached).
 *
 * Missing `OrganizationConfig` rows fall back to `OrganizationSettings.default()`, so this
 * returns an identical result for a config-less organization (the normal org-creation path seeds
 * no rows) and for one whose defaults have been fully materialised (as
 * `systemAdmin.createOrganization` does).
 */
export async function readOrganizationSettings(
    prisma: Pick<PrismaClient, "organizationConfig">,
    organizationId: string,
): Promise<OrganizationSettings> {
    const records = await prisma.organizationConfig.findMany({ where: { organizationId } });

    return OrganizationSettings.fromRecords(records);
}

/**
 * Persist an organization's settings, upserting only the `OrganizationConfig` rows whose value
 * actually changed relative to the currently-resolved settings.
 *
 * Because the comparison is against resolved settings (defaults included), a config-less
 * organization only materialises the leaves that differ from the defaults, while a fully
 * materialised organization only rewrites the leaves that genuinely changed. Both end up
 * resolving to the same settings object.
 *
 * `logEntry` is invoked with the computed changes and its `PrismaPromise` is executed inside the
 * same `$transaction` as the config writes, so the audit entry can never drift from the write.
 *
 * Does NOT invalidate the settings cache — callers must call `revalidateOrganizationSettings`
 * (from `./organization-settings-cache`) afterwards.
 *
 * @returns the organization's settings as they stand after the write.
 */
export async function writeOrganizationSettings(
    prisma: OrganizationSettingsPrisma,
    organizationId: string,
    settings: OrganizationSettings,
    logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
): Promise<OrganizationSettings> {
    // Validate before writing — the settings may have come straight off the wire.
    const parsed = OrganizationSettings.schema.parse(settings);

    const existing = await readOrganizationSettings(prisma, organizationId);

    const flattenedExisting = OrganizationSettings.flatten(existing);
    const flattenedNext = OrganizationSettings.flatten(parsed);

    const upserts = R.pipe(
        R.entries(flattenedNext),
        R.filter(([key, newValue]) => newValue !== flattenedExisting[key]),
        R.map(([key, value]) =>
            prisma.organizationConfig.upsert({
                where: { organizationId_key: { organizationId, key } },
                create: { organizationId, key, value },
                update: { value },
            }),
        ),
    );

    const changes = diffObject(flattenedExisting, flattenedNext);

    await prisma.$transaction([...upserts, ...(logEntry ? [logEntry(changes)] : [])]);

    return await readOrganizationSettings(prisma, organizationId);
}
