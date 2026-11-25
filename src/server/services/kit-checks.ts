/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Kit checks: email each D4H member of the chosen teams their own kit-check form, built from an
 * I3 bundle and pre-filled from D4H. See `docs/plans/2026-11-25-kit-check-send.md`.
 *
 * What a member is asked is snapshotted at send (decisions 6 and 6a): per team, the bundle's
 * comparable lines as `KitCheckTemplate`s, and per member, the items D4H records as issued to them
 * as `KitCheckHeldItem`s, with a pre-filled answer.
 */

import "server-only";

import { NotFoundError, ValidationError } from "@/lib/errors";
import {
    compareBundle,
    type BundleRow,
    type ComparableLine,
    type ExcludedReason,
} from "@/lib/i3-bundle-compare";
import type { ItemQualityResult } from "@/lib/i3-item-quality";
import { EMPTY_ANSWER } from "@/lib/kit-check-validate";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import type { D4HTeamRef } from "@/lib/schemas/d4h/team";
import type { I3Bundle, I3BundleId, I3BundleLine, I3BundleSummary } from "@/lib/schemas/i3-bundle";
import type {
    KitCheckAnswerData,
    KitCheckD4HTeam,
    KitCheckHeldItem,
    KitCheckProblem,
    KitCheckResponseData,
    KitCheckTemplate,
} from "@/lib/schemas/kit-check";
import { toD4HCredentialRef } from "@/server/d4h-access-token";
import { getD4HTeamMembers, getD4HTokenMetadata } from "@/server/d4h-api/client";
import { fetchD4HTeamEquipmentItems, filterTeamIssuedItems } from "@/server/d4h-api/equipment";

import * as I3Bundles from "./i3-bundles";
import * as I3Templates from "./i3-templates";
import type { OrgServiceContext } from "./service-context";

// Snapshot (pure)

/** An I3 variant, as the snapshot reads it. */
export type KitCheckVariantSource = {
    id: string;
    templateId: string;
    name: string;
    d4h: { brandId: number; modelId: number } | null;
};

/** An issued item with its holder, as the comparison reads it. */
export type KitCheckIssuedItem = D4HEquipmentListItem & { holder: { id: number } };

/** A D4H member, as the snapshot reads it. */
export type KitCheckMemberSource = { id: number; name: string };

export type KitCheckMemberSnapshot<M extends KitCheckMemberSource> = {
    member: M;
    /** How many of the team's templates the member holds. */
    heldCount: number;
    heldItems: KitCheckHeldItem[];
    /** The pre-filled answer: every held item `has: "yes"`. */
    response: KitCheckResponseData;
};

export type KitCheckSnapshot<M extends KitCheckMemberSource> = {
    templates: KitCheckTemplate[];
    members: KitCheckMemberSnapshot<M>[];
};

/** A held item's problems, from its quality against its template. */
function problemsOf(quality: ItemQualityResult): KitCheckProblem[] {
    const problems: KitCheckProblem[] = [];
    if (quality.missing.includes("serial")) problems.push("serial");
    if (
        quality.missing.includes("brand") ||
        quality.missing.includes("model") ||
        quality.mismatch !== null
    ) {
        problems.push("variant");
    }
    return problems;
}

/** Brand and model, when D4H has them, otherwise the item's ref. */
function describeItem(item: D4HEquipmentListItem): string {
    const brandModel = [item.brand.title, item.model?.title]
        .filter((part): part is string => !!part && part.trim() !== "")
        .join(" ");
    return brandModel || item.ref;
}

/**
 * One team's kit-check snapshot, from that team's bundle comparison (decision 6a).
 *
 * - **Templates:** one per comparable line, in the comparison's order. A template offers the
 *   variants that have a D4H record and fit the team (`fittingVariantIds`), labelled with their
 *   name. With none to offer, it asks for a free-text size, which may be left blank.
 * - **Held items:** one per counted item (LOST items don't count) of each held line. Its
 *   `variantId` is the offered variant whose D4H brand and model both equal the item's, or `null`.
 * - **Answer:** every held item pre-filled `has: "yes"`; nothing else answered.
 */
export function buildKitCheckSnapshot<M extends KitCheckMemberSource>({
    columns,
    rows,
    variants,
    fittingVariantIds,
}: {
    columns: readonly ComparableLine<I3BundleLine>[];
    rows: readonly BundleRow<M, KitCheckIssuedItem>[];
    variants: readonly KitCheckVariantSource[];
    fittingVariantIds: readonly string[];
}): KitCheckSnapshot<M> {
    const fitting = new Set(fittingVariantIds);
    const offered = columns.map((column) =>
        variants
            .filter(
                (variant) =>
                    variant.templateId === column.template.id &&
                    variant.d4h !== null &&
                    fitting.has(variant.id),
            )
            .toSorted((a, b) => a.name.localeCompare(b.name)),
    );

    const templates = columns.map(
        (column, index): KitCheckTemplate => ({
            id: column.template.id,
            category: column.template.d4h.categoryTitle,
            name: column.template.name,
            variants: offered[index].map((variant) => ({ id: variant.id, label: variant.name })),
            requireSN: column.template.d4h.requireSN,
            sized: offered[index].length === 0,
            sizeOptional: true,
            sizeOptions: [],
        }),
    );

    const members = rows.map((row): KitCheckMemberSnapshot<M> => {
        const heldItems = row.cells.flatMap((cell, index) =>
            cell.items.map(({ item, quality }): KitCheckHeldItem => {
                const matched = offered[index].find(
                    (variant) =>
                        variant.d4h !== null &&
                        variant.d4h.brandId === item.brand.id &&
                        variant.d4h.modelId === (item.model?.id ?? null),
                );
                return {
                    id: String(item.id),
                    templateId: columns[index].template.id,
                    description: describeItem(item),
                    serial: item.serial,
                    variantId: matched?.id ?? null,
                    problems: problemsOf(quality),
                };
            }),
        );
        const held: Record<string, KitCheckAnswerData> = Object.fromEntries(
            heldItems.map((held) => [held.id, { ...EMPTY_ANSWER, has: "yes" as const }]),
        );
        return {
            member: row.member,
            heldCount: row.heldCount,
            heldItems,
            response: { held, missing: {}, extras: [], comments: "" },
        };
    });

    return { templates, members };
}

// D4H and bundle reads

/** The D4H teams the caller's token reaches. */
export async function listD4HTeams(
    _ctx: OrgServiceContext,
    accessToken: D4HAccessToken_ServerOnly,
): Promise<D4HTeamRef[]> {
    const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));
    return d4HTeams;
}

/** The organization's Active bundles, by name. */
export async function listBundles(ctx: OrgServiceContext): Promise<I3BundleSummary[]> {
    const bundles = await I3Bundles.list(ctx);
    return bundles.filter((bundle) => bundle.status === "Active");
}

/** A D4H member of a kit check's team, with the email the form is sent to. */
export type KitCheckRecipient = KitCheckMemberSource & {
    /** Trimmed; `null` when D4H has none. */
    email: string | null;
};

/** A bundle line the comparison leaves out for a team, and why. */
export type KitCheckExcludedLine = {
    templateId: string;
    name: string;
    reason: ExcludedReason;
};

export type KitCheckTeamSnapshot = KitCheckSnapshot<KitCheckRecipient> & {
    team: KitCheckD4HTeam;
    excluded: KitCheckExcludedLine[];
};

/**
 * Compare the bundle against each team and snapshot what each member would be asked, as the
 * caller's D4H token sees it. The preview shows it; the send stores it.
 *
 * @throws NotFoundError if the bundle isn't in the organization, or the token doesn't reach a team.
 * @throws ValidationError if the bundle is Deleted.
 */
export async function computeTeamSnapshots(
    ctx: OrgServiceContext,
    {
        accessToken,
        bundleId,
        d4hTeamIds,
    }: { accessToken: D4HAccessToken_ServerOnly; bundleId: I3BundleId; d4hTeamIds: number[] },
): Promise<{ bundle: I3Bundle; teams: KitCheckTeamSnapshot[] }> {
    const credentialRef = toD4HCredentialRef(accessToken);
    const [{ d4HTeams }, bundleWithLines] = await Promise.all([
        getD4HTokenMetadata(credentialRef),
        I3Bundles.getWithLines(ctx, bundleId),
    ]);

    if (!bundleWithLines) throw new NotFoundError(`I3Bundle(id=${bundleId}) not found.`);
    const { bundle, lines } = bundleWithLines;
    if (bundle.status !== "Active") {
        throw new ValidationError(`I3Bundle(id=${bundleId}) is ${bundle.status}.`);
    }

    const teamIds = [...new Set(d4hTeamIds)];
    const teams = teamIds.map((teamId) => {
        const team = d4HTeams.find((candidate) => candidate.id === teamId);
        if (!team) throw new NotFoundError(`D4H team ${teamId} not found.`);
        return { id: team.id, title: team.title };
    });

    const variants = await ctx.prisma.i3TemplateVariant.findMany({
        where: { templateId: { in: lines.map((line) => line.template.id) } },
        include: { d4h: true },
    });
    const variantSources = variants.map(
        (variant): KitCheckVariantSource => ({
            id: variant.id,
            templateId: variant.templateId,
            name: variant.name,
            d4h: variant.d4h
                ? { brandId: variant.d4h.brandId, modelId: variant.d4h.modelId }
                : null,
        }),
    );

    const snapshots = await Promise.all(
        teams.map(async (team): Promise<KitCheckTeamSnapshot> => {
            const [fits, items, members] = await Promise.all([
                I3Templates.listFitsForD4HTeam(ctx, { accessToken, teamId: team.id }),
                fetchD4HTeamEquipmentItems(accessToken, team.id),
                getD4HTeamMembers(credentialRef, team.id),
            ]);

            const issued = filterTeamIssuedItems(items, team.id).map(
                ({ item, holderId }): KitCheckIssuedItem => ({ ...item, holder: { id: holderId } }),
            );
            const recipients = members.map(
                (member): KitCheckRecipient => ({
                    id: member.id,
                    name: member.name,
                    email: member.email?.value.trim() || null,
                }),
            );

            const comparison = compareBundle({
                lines,
                members: recipients,
                items: issued,
                fittingTemplateIds: fits.templateIds,
            });

            const snapshot = buildKitCheckSnapshot({
                columns: comparison.columns,
                rows: comparison.rows,
                variants: variantSources,
                fittingVariantIds: fits.variantIds,
            });

            return {
                team,
                ...snapshot,
                excluded: comparison.excluded.map(({ line, reason }) => ({
                    templateId: line.template.id,
                    name: line.template.name,
                    reason,
                })),
            };
        }),
    );

    return { bundle, teams: snapshots };
}

/** One team in the recipients preview. */
export type KitCheckPreviewTeam = {
    team: KitCheckD4HTeam;
    /** How many of the bundle's lines the team's members are asked about. */
    templateCount: number;
    members: (KitCheckRecipient & { heldCount: number })[];
    excluded: KitCheckExcludedLine[];
};

/**
 * Who a kit check would go to: per team, its members with their email and how many of the
 * bundle's lines they hold, and the lines the comparison leaves out and why.
 *
 * @throws NotFoundError if the bundle isn't in the organization, or the token doesn't reach a team.
 * @throws ValidationError if the bundle is Deleted.
 */
export async function previewRecipients(
    ctx: OrgServiceContext,
    input: { accessToken: D4HAccessToken_ServerOnly; bundleId: I3BundleId; d4hTeamIds: number[] },
): Promise<KitCheckPreviewTeam[]> {
    const { teams } = await computeTeamSnapshots(ctx, input);

    return teams.map(({ team, templates, members, excluded }) => ({
        team,
        templateCount: templates.length,
        members: members.map(({ member, heldCount }) => ({ ...member, heldCount })),
        excluded,
    }));
}
