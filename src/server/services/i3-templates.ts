/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { templateFitsTeam, variantFitsTeam } from "@/lib/i3-template-fit";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HAccessTokenMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { I3Template, I3TemplateId } from "@/lib/schemas/i3-template";
import { I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";
import { toD4HCredentialRef } from "@/server/d4h-access-token";
import { getD4HTokenMetadata } from "@/server/d4h-api/client";
import { fetchD4HTeamEquipmentCatalogue } from "@/server/d4h-api/equipment";

import type { OrgServiceContext } from "./service-context";

/**
 * Fetch an I3 Template by ID, or `null` if it does not exist within the organization. Callers
 * that need the template to exist should use `requireById` instead.
 */
export async function getById(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template | null> {
    const template = await ctx.prisma.i3Template.findUnique({
        where: { id: templateId, organizationId: ctx.organizationId },
        include: { d4h: true },
    });

    if (!template) return null;

    return I3Template.fromRecord(template);
}

/**
 * Fetch an I3 Template by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the template does not exist within the organization.
 */
export async function requireById(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template> {
    const template = await getById(ctx, templateId);

    if (!template) {
        throw new NotFoundError(`I3Template(id=${templateId}) not found.`);
    }

    return template;
}

/**
 * Soft-delete an I3 Template (reversible via `recover`). No-op, returning the existing
 * record unchanged, if the template is already `Deleted`.
 *
 * I3Template has no archive concept (#295) — only delete/recover.
 * `I3TemplateVariant` rows are deliberately left untouched (out of scope for #295; they have no
 * `RecordStatus` column of their own).
 * @throws NotFoundError if the template is not found in the organization.
 */
export async function deleteRecord(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template> {
    const existing = await requireById(ctx, templateId);

    if (existing.status === "Deleted") {
        return existing;
    }

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.i3Template.update({
            where: { id: templateId, organizationId: ctx.organizationId },
            data: { status: "Deleted" },
            include: { d4h: true },
        }),
        ctx.logEvent({ action: "Delete", objectType: "I3Template", objectId: templateId }),
    ]);

    return I3Template.fromRecord(updated);
}

/**
 * Recover a `Deleted` I3 Template back to `Active`. No-op, returning the existing record
 * unchanged, if the template is already `Active`.
 * @throws NotFoundError if the template is not found in the organization.
 * @throws ValidationError if the template is not `Deleted` (there is no archive state to guard
 * against here, but a future non-`Active`/`Deleted` status should still be rejected explicitly).
 */
export async function recover(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template> {
    const existing = await requireById(ctx, templateId);

    if (existing.status === "Active") {
        return existing;
    }

    if (existing.status !== "Deleted") {
        throw new ValidationError(
            `I3Template(id=${templateId}) has status ${existing.status}; only a Deleted template can be recovered from rubbish.`,
        );
    }

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.i3Template.update({
            where: { id: templateId, organizationId: ctx.organizationId },
            data: { status: "Active" },
            include: { d4h: true },
        }),
        ctx.logEvent({ action: "Recover", objectType: "I3Template", objectId: templateId }),
    ]);

    return I3Template.fromRecord(updated);
}

/** One D4H team the token reaches, and that team's own equipment catalogue. */
export type D4HTeamFitContext = {
    team: D4HAccessTokenMetadata["d4HTeams"][number];
    catalogue: Awaited<ReturnType<typeof fetchD4HTeamEquipmentCatalogue>>;
};

/**
 * Everything the template fit rule (`src/lib/i3-template-fit.ts`) needs for one D4H team: the
 * team, from the token's metadata, and the team's own equipment catalogue, fetched from D4H.
 * @throws NotFoundError if the token doesn't reach `teamId`.
 */
export async function getD4HTeamFitContext(
    // Not read today; taken like every other service so callers pass their context as is.
    _ctx: OrgServiceContext,
    { accessToken, teamId }: { accessToken: D4HAccessToken_ServerOnly; teamId: number },
): Promise<D4HTeamFitContext> {
    const metadata = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));

    const team = metadata.d4HTeams.find((candidate) => candidate.id === teamId);
    if (!team) {
        throw new NotFoundError(`D4H team ${teamId} not found.`);
    }

    const catalogue = await fetchD4HTeamEquipmentCatalogue(accessToken, teamId, metadata);
    return { team, catalogue };
}

/**
 * The organization's non-Deleted templates, and their variants, that can be issued to D4H team
 * `teamId`, by the fit rule in `src/lib/i3-template-fit.ts`.
 * @throws NotFoundError if the token doesn't reach `teamId`.
 */
export async function listFitsForD4HTeam(
    ctx: OrgServiceContext,
    { accessToken, teamId }: { accessToken: D4HAccessToken_ServerOnly; teamId: number },
): Promise<{ templateIds: I3TemplateId[]; variantIds: I3TemplateVariantId[] }> {
    const [{ team, catalogue }, templates] = await Promise.all([
        getD4HTeamFitContext(ctx, { accessToken, teamId }),
        ctx.prisma.i3Template.findMany({
            where: { organizationId: ctx.organizationId, status: { not: "Deleted" } },
            include: { d4h: true, variants: { include: { d4h: true } } },
        }),
    ]);

    const templateIds: I3TemplateId[] = [];
    const variantIds: I3TemplateVariantId[] = [];

    for (const template of templates) {
        if (templateFitsTeam(template.d4h, catalogue, team)) {
            templateIds.push(I3TemplateId.schema.parse(template.id));
        }
        for (const variant of template.variants) {
            if (variantFitsTeam(variant.d4h, template.d4h, catalogue, team)) {
                variantIds.push(I3TemplateVariantId.schema.parse(variant.id));
            }
        }
    }

    return { templateIds, variantIds };
}
