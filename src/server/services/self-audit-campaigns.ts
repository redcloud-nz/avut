/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Self Audit Campaigns: email the D4H members of one team their own self-audit form, built from an
 * I3 bundle and pre-filled from D4H. See `docs/plans/2026-11-25-kit-check-send.md`, and
 * `docs/plans/2026-11-27-self-audit-campaigns.md` for campaigns pinned to one team, created as a
 * Draft and then sent.
 *
 * What a member is asked is snapshotted (decisions 6 and 6a): at create, the bundle's comparable
 * lines for the team's D4H team as `SelfAuditTemplate`s, and per member, the items D4H records as
 * issued to them as `SelfAuditHeldItem`s, with a pre-filled answer.
 */

import "server-only";

import { addDays } from "date-fns";
import * as z from "zod";

import { baseUrl } from "@/emails/base-url";
import SelfAuditRequestEmail, { selfAuditRequestSubject } from "@/emails/self-audit-request";
import type { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { SelfAuditForm } from "@/lib/forms";
import { compareBundle, type BundleRow, type ComparableLine } from "@/lib/i3-bundle-compare";
import type { ItemQualityResult } from "@/lib/i3-item-quality";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import {
    I3BundleLine,
    type I3Bundle,
    type I3BundleId,
    type I3BundleSummary,
} from "@/lib/schemas/i3-bundle";
import {
    SELF_AUDIT_RECIPIENTS_MAX,
    SELF_AUDIT_TOKEN_DAYS,
    SelfAuditCampaignId,
    SelfAuditHeldItem,
    SelfAuditRequestId,
    SelfAuditResponseData,
    SelfAuditStatus,
    SelfAuditTemplate,
    type SelfAuditAnswerData,
    type SelfAuditDeliveryStatus,
    type SelfAuditProblem,
} from "@/lib/schemas/self-audit";
import { TeamId } from "@/lib/schemas/team";
import { defaultCampaignName } from "@/lib/self-audit-campaign-name";
import {
    buildNeedsReport,
    needsReportCsv,
    type SelfAuditNeedsReport,
    type SelfAuditNeedsSource,
} from "@/lib/self-audit-needs";
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";
import { toD4HCredentialRef } from "@/server/d4h-access-token";
import {
    expireD4HTeamMembers,
    getD4HTeamMembers,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";
import { fetchD4HTeamEquipmentItems, filterTeamIssuedItems } from "@/server/d4h-api/equipment";
import { NoReplyEmailAddress, orgReplyTo, sendEmail } from "@/server/email";
import { createLinkToken } from "@/server/link-token";
import { createLogBatch } from "@/server/log-entry";

import * as I3Bundles from "./i3-bundles";
import * as I3Templates from "./i3-templates";
import * as OrgSettings from "./organization-settings";
import { withBatch, type OrgServiceContext } from "./service-context";

// Snapshot (pure)

/** An I3 variant, as the snapshot reads it. */
export type SelfAuditVariantSource = {
    id: string;
    templateId: string;
    name: string;
    d4h: { brandId: number; modelId: number } | null;
};

/** An issued item with its holder, as the comparison reads it. */
export type SelfAuditIssuedItem = D4HEquipmentListItem & { holder: { id: number } };

/** A D4H member, as the snapshot reads it. */
export type SelfAuditMemberSource = { id: number; name: string };

export type SelfAuditMemberSnapshot<M extends SelfAuditMemberSource> = {
    member: M;
    /** How many of the team's templates the member holds. */
    heldCount: number;
    heldItems: SelfAuditHeldItem[];
    /** The starting answer: an unanswered entry per held item. */
    response: SelfAuditResponseData;
};

export type SelfAuditSnapshot<M extends SelfAuditMemberSource> = {
    templates: SelfAuditTemplate[];
    members: SelfAuditMemberSnapshot<M>[];
};

/** A held item's problems, from its quality against its template. */
function problemsOf(quality: ItemQualityResult): SelfAuditProblem[] {
    const problems: SelfAuditProblem[] = [];
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
 * One team's self-audit snapshot, from that team's bundle comparison (decision 6a).
 *
 * - **Templates:** one per comparable line, in the comparison's order. A template offers the
 *   variants that have a D4H record and fit the team (`fittingVariantIds`), labelled with their
 *   name. With none to offer, it asks for a free-text size, which may be left blank.
 * - **Held items:** one per counted item (LOST items don't count) of each held line, each item
 *   once, under the first line it matches. Its `variantId` is the variant whose D4H brand and model
 *   both equal the item's, when that variant is offered; otherwise `null`. A match that isn't
 *   offered (it doesn't fit the team) is a `"variant"` problem, so the member is asked.
 * - **Answer:** an unanswered entry per held item; nothing answered.
 */
export function buildSelfAuditSnapshot<M extends SelfAuditMemberSource>({
    columns,
    rows,
    variants,
    fittingVariantIds,
}: {
    columns: readonly ComparableLine<I3BundleLine>[];
    rows: readonly BundleRow<M, SelfAuditIssuedItem>[];
    variants: readonly SelfAuditVariantSource[];
    fittingVariantIds: readonly string[];
}): SelfAuditSnapshot<M> {
    const fitting = new Set(fittingVariantIds);
    /** Per column, every variant of its template with a D4H record, fitting the team or not. */
    const recorded = columns.map((column) =>
        variants
            .filter((variant) => variant.templateId === column.template.id && variant.d4h !== null)
            .toSorted((a, b) => a.name.localeCompare(b.name)),
    );
    const offered = recorded.map((candidates) =>
        candidates.filter((variant) => fitting.has(variant.id)),
    );

    const templates = columns.map(
        (column, index): SelfAuditTemplate => ({
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

    const members = rows.map((row): SelfAuditMemberSnapshot<M> => {
        // Two templates can share a D4H kind, so one item can turn up under both columns. Answers
        // are keyed by item id, so it's listed once, under the first.
        const seen = new Set<number>();
        const heldItems = row.cells.flatMap((cell, index) =>
            cell.items.flatMap(({ item, quality }): SelfAuditHeldItem[] => {
                if (seen.has(item.id)) return [];
                seen.add(item.id);
                const matched = recorded[index].find(
                    (variant) =>
                        variant.d4h !== null &&
                        variant.d4h.brandId === item.brand.id &&
                        variant.d4h.modelId === (item.model?.id ?? null),
                );
                const isOffered = matched !== undefined && offered[index].includes(matched);
                const problems = problemsOf(quality);
                // A variant that doesn't fit the team isn't one the member can pick: ask them.
                if (matched && !isOffered && !problems.includes("variant")) {
                    problems.push("variant");
                }
                return [
                    {
                        id: String(item.id),
                        templateId: columns[index].template.id,
                        description: describeItem(item),
                        serial: item.serial,
                        variantId: isOffered ? matched.id : null,
                        problems,
                    },
                ];
            }),
        );
        const held: Record<string, SelfAuditAnswerData> = Object.fromEntries(
            // Unanswered: a pre-ticked "Yes" read as already answered (checkpoint 2).
            heldItems.map((held) => [held.id, { ...EMPTY_ANSWER, has: null }]),
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

// Teams and bundles

/** An AVUT team a self audit campaign can be pinned to, with the D4H team it's linked to. */
export type SelfAuditTeamOption = {
    id: TeamId;
    name: string;
    d4hTeamId: number;
    d4hTeamName: string;
};

/**
 * The organization's Active teams linked to a D4H team the caller's token reaches, by name: the
 * teams a self audit campaign can be pinned to.
 */
export async function listTeams(
    ctx: OrgServiceContext,
    accessToken: D4HAccessToken_ServerOnly,
): Promise<SelfAuditTeamOption[]> {
    const [{ d4HTeams }, teams] = await Promise.all([
        getD4HTokenMetadata(toD4HCredentialRef(accessToken)),
        ctx.prisma.team.findMany({
            where: { organizationId: ctx.organizationId, status: "Active" },
            select: {
                id: true,
                name: true,
                d4h: { select: { d4hTeamId: true, d4hTeamName: true } },
            },
            orderBy: { name: "asc" },
        }),
    ]);
    const reachable = new Set(d4HTeams.map((team) => team.id));

    return teams.flatMap(({ id, name, d4h }): SelfAuditTeamOption[] =>
        d4h && reachable.has(d4h.d4hTeamId)
            ? [
                  {
                      id: TeamId.schema.parse(id),
                      name,
                      d4hTeamId: d4h.d4hTeamId,
                      d4hTeamName: d4h.d4hTeamName,
                  },
              ]
            : [],
    );
}

/** The organization's Active bundles, by name. */
export async function listBundles(ctx: OrgServiceContext): Promise<I3BundleSummary[]> {
    const bundles = await I3Bundles.list(ctx);
    return bundles.filter((bundle) => bundle.status === "Active");
}

/** A D4H member of a self audit campaign's team, with the email the form is sent to. */
export type SelfAuditRecipient = SelfAuditMemberSource & {
    /** Trimmed; `null` when D4H has none. */
    email: string | null;
};

/** A D4H member's email as a self-audit is sent to it: trimmed, or `null` when D4H has none. */
function emailOf(member: { email?: { value: string } | null }): string | null {
    return member.email?.value.trim() || null;
}

/**
 * Check the caller's D4H token reaches a campaign's D4H team.
 *
 * @throws NotFoundError if it doesn't.
 */
async function requireReachableD4HTeam(
    accessToken: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
): Promise<void> {
    const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));
    if (!d4HTeams.some((candidate) => candidate.id === d4hTeamId)) {
        throw new NotFoundError(`D4H team ${d4hTeamId} not found.`);
    }
}

/**
 * The bundle's templates as one D4H team is asked them: its comparable lines for that team, with
 * the variants that fit it, as the caller's D4H token sees it. Reads no members or equipment: a
 * campaign is created with none, and members are snapshotted as they're added.
 *
 * @throws NotFoundError if the bundle isn't in the organization, or the token doesn't reach the team.
 * @throws ValidationError if the bundle is Deleted.
 */
async function snapshotTemplates(
    ctx: OrgServiceContext,
    {
        accessToken,
        bundleId,
        d4hTeamId,
    }: { accessToken: D4HAccessToken_ServerOnly; bundleId: I3BundleId; d4hTeamId: number },
): Promise<{ bundle: I3Bundle; templates: SelfAuditTemplate[] }> {
    const [, bundleWithLines] = await Promise.all([
        requireReachableD4HTeam(accessToken, d4hTeamId),
        I3Bundles.getWithLines(ctx, bundleId),
    ]);

    if (!bundleWithLines) throw new NotFoundError(`I3Bundle(id=${bundleId}) not found.`);
    const { bundle, lines } = bundleWithLines;
    if (bundle.status !== "Active") {
        throw new ValidationError(`I3Bundle(id=${bundleId}) is ${bundle.status}.`);
    }

    const [variants, fits] = await Promise.all([
        ctx.prisma.i3TemplateVariant.findMany({
            where: { templateId: { in: lines.map((line) => line.template.id) } },
            include: { d4h: true },
        }),
        I3Templates.listFitsForD4HTeam(ctx, { accessToken, teamId: d4hTeamId }),
    ]);
    const variantSources = variants.map(
        (variant): SelfAuditVariantSource => ({
            id: variant.id,
            templateId: variant.templateId,
            name: variant.name,
            d4h: variant.d4h
                ? { brandId: variant.d4h.brandId, modelId: variant.d4h.modelId }
                : null,
        }),
    );

    const { columns } = compareBundle({
        lines,
        members: [],
        items: [],
        fittingTemplateIds: fits.templateIds,
    });
    const { templates } = buildSelfAuditSnapshot<SelfAuditMemberSource>({
        columns,
        rows: [],
        variants: variantSources,
        fittingVariantIds: fits.variantIds,
    });
    return { bundle, templates };
}

// Admin reads

/**
 * A request's one status (decision 11 of the campaigns plan), by precedence: Withdrawn >
 * Submitted > Editing > Opened > Failed > No email > Sent (`Pending` included) > Not sent.
 * `Editing` is submitted, then reopened.
 */
export function statusOf(request: {
    deliveryStatus: SelfAuditDeliveryStatus;
    openedAt: Date | null;
    submittedAt: Date | null;
    formStatus: string;
    withdrawnAt?: Date | null;
}): SelfAuditStatus {
    if (request.withdrawnAt) return "Withdrawn";
    if (request.formStatus === "Submitted") return "Submitted";
    if (request.submittedAt !== null) return "Editing";
    if (request.openedAt !== null) return "Opened";
    switch (request.deliveryStatus) {
        case "Failed":
            return "Failed";
        case "NoEmail":
            return "NoEmail";
        case "Sent":
        case "Pending":
            return "Sent";
        case "Unsent":
            return "Unsent";
    }
}

/** How many of a self audit campaign's requests are in each status. */
export type SelfAuditCampaignCounts = Record<SelfAuditStatus, number>;

function countRequests(requests: readonly SelfAuditRequestSummary[]): SelfAuditCampaignCounts {
    const counts = Object.fromEntries(
        SelfAuditStatus.options.map((status) => [status, 0]),
    ) as SelfAuditCampaignCounts;
    for (const request of requests) counts[request.status]++;
    return counts;
}

/** A self audit campaign, as its list row and its page header show it. */
export type SelfAuditCampaignSummary = {
    id: SelfAuditCampaignId;
    name: string;
    /** The AVUT team it's pinned to. */
    team: { id: TeamId; name: string };
    /** The D4H team's name, as linked at create. */
    d4hTeamName: string;
    bundleName: string;
    /** Null while a Draft. */
    sentAt: Date | null;
    /** Null while a Draft, or once the sender's account is purged. */
    sentByName: string | null;
    createdAt: Date;
    updatedAt: Date;
    counts: SelfAuditCampaignCounts;
};

/** One member's request, as a self audit campaign's page shows it. Never carries the token hash. */
export type SelfAuditRequestSummary = {
    id: SelfAuditRequestId;
    d4hMemberId: number;
    memberName: string;
    email: string | null;
    deliveryStatus: SelfAuditDeliveryStatus;
    sentAt: Date | null;
    openedAt: Date | null;
    submittedAt: Date | null;
    expiresAt: Date | null;
    /** Set while the member is withdrawn from the sent campaign. */
    withdrawnAt: Date | null;
    /** The instance's: `Submitted`, or `Draft` (never opened, being answered, or reopened). */
    formStatus: string;
    status: SelfAuditStatus;
};

/** A request as the admin pages read it: everything but the token hash and the answers. */
const requestSelect = {
    id: true,
    d4hMemberId: true,
    memberName: true,
    email: true,
    deliveryStatus: true,
    sentAt: true,
    openedAt: true,
    submittedAt: true,
    expiresAt: true,
    withdrawnAt: true,
    formInstance: { select: { formStatus: true } },
} as const;

/** What `requestSelect` reads. */
type RequestRecord = Omit<SelfAuditRequestSummary, "id" | "formStatus" | "status"> & {
    id: string;
    formInstance: { formStatus: string };
};

function toRequestSummary({ formInstance, ...request }: RequestRecord): SelfAuditRequestSummary {
    const { formStatus } = formInstance;
    return {
        ...request,
        id: SelfAuditRequestId.schema.parse(request.id),
        formStatus,
        status: statusOf({ ...request, formStatus }),
    };
}

/** A campaign as the admin pages read it, its requests aside. */
const campaignSelect = {
    id: true,
    name: true,
    d4hTeamName: true,
    bundleName: true,
    sentAt: true,
    createdAt: true,
    updatedAt: true,
    team: { select: { id: true, name: true } },
    sentBy: { select: { name: true } },
    requests: { select: requestSelect },
} as const;

function toCampaignSummary(
    campaign: {
        id: string;
        name: string;
        d4hTeamName: string;
        bundleName: string;
        sentAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        team: { id: string; name: string };
        sentBy: { name: string } | null;
    },
    requests: readonly SelfAuditRequestSummary[],
): SelfAuditCampaignSummary {
    return {
        id: SelfAuditCampaignId.schema.parse(campaign.id),
        name: campaign.name,
        team: { id: TeamId.schema.parse(campaign.team.id), name: campaign.team.name },
        d4hTeamName: campaign.d4hTeamName,
        bundleName: campaign.bundleName,
        sentAt: campaign.sentAt,
        sentByName: campaign.sentBy?.name ?? null,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        counts: countRequests(requests),
    };
}

/** The organization's self audit campaigns, newest first, each with its counts by status. */
export async function listCampaigns(ctx: OrgServiceContext): Promise<SelfAuditCampaignSummary[]> {
    const campaigns = await ctx.prisma.selfAuditCampaign.findMany({
        where: { organizationId: ctx.organizationId },
        select: campaignSelect,
        orderBy: { createdAt: "desc" },
    });

    return campaigns.map(({ requests, ...campaign }) =>
        toCampaignSummary(campaign, requests.map(toRequestSummary)),
    );
}

/**
 * A self audit campaign with its requests, by member name.
 *
 * @throws NotFoundError if the self audit campaign isn't in the organization.
 */
export async function requireCampaignById(
    ctx: OrgServiceContext,
    campaignId: SelfAuditCampaignId,
): Promise<SelfAuditCampaignSummary & { requests: SelfAuditRequestSummary[] }> {
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: campaignSelect,
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);

    const requests = campaign.requests
        .map(toRequestSummary)
        .toSorted((a, b) => a.memberName.localeCompare(b.memberName));
    return { ...toCampaignSummary(campaign, requests), requests };
}

/** What a member was asked, and what they've answered. */
export type SelfAuditAnswers = {
    /** The campaign's templates, as snapshotted at create. */
    templates: SelfAuditTemplate[];
    heldItems: SelfAuditHeldItem[];
    /** The last submitted answer (decision 10); null until the first submit. */
    submittedData: SelfAuditResponseData | null;
    /** The working copy. */
    formData: SelfAuditResponseData;
    formStatus: string;
};

/**
 * A request's snapshot and answers: what the campaign page's answers dialog shows.
 *
 * @throws NotFoundError if the request isn't in the organization.
 */
export async function getRequestAnswers(
    ctx: OrgServiceContext,
    requestId: SelfAuditRequestId,
): Promise<SelfAuditAnswers> {
    const request = await ctx.prisma.selfAuditRequest.findFirst({
        where: { id: requestId, organizationId: ctx.organizationId },
        select: {
            heldItems: true,
            submittedData: true,
            campaign: { select: { templates: true } },
            formInstance: { select: { formData: true, formStatus: true } },
        },
    });
    if (!request) throw new NotFoundError(`SelfAuditRequest(id=${requestId}) not found.`);

    return {
        templates: z.array(SelfAuditTemplate).parse(request.campaign.templates),
        heldItems: z.array(SelfAuditHeldItem).parse(request.heldItems),
        submittedData:
            request.submittedData === null
                ? null
                : SelfAuditResponseData.parse(request.submittedData),
        formData: SelfAuditResponseData.parse(request.formInstance.formData),
        formStatus: request.formInstance.formStatus,
    };
}

/**
 * The campaign's stored templates, and the requests the needs report and the differences read
 * (decision 1 of `docs/plans/2026-11-28-self-audit-needs-and-fixes.md`): submitted and not
 * withdrawn, each with its last submitted answer. A reopened form counts with that answer.
 *
 * @throws NotFoundError if the self audit campaign isn't in the organization.
 */
async function loadSubmittedAnswers(
    ctx: OrgServiceContext,
    campaignId: SelfAuditCampaignId,
): Promise<{ templates: SelfAuditTemplate[]; requests: SelfAuditNeedsSource[] }> {
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: {
            templates: true,
            requests: {
                where: { submittedAt: { not: null }, withdrawnAt: null },
                select: { memberName: true, heldItems: true, submittedData: true },
            },
        },
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);

    return {
        templates: z.array(SelfAuditTemplate).parse(campaign.templates),
        requests: campaign.requests.flatMap((request) =>
            request.submittedData === null
                ? []
                : [
                      {
                          memberName: request.memberName,
                          heldItems: z.array(SelfAuditHeldItem).parse(request.heldItems),
                          submittedData: SelfAuditResponseData.parse(request.submittedData),
                      },
                  ],
        ),
    };
}

/**
 * What the campaign's members need, from their submitted answers: grouped by template, variant
 * and size, and the needs not on the list.
 *
 * @throws NotFoundError if the self audit campaign isn't in the organization.
 */
export async function getNeedsReport(
    ctx: OrgServiceContext,
    campaignId: SelfAuditCampaignId,
): Promise<SelfAuditNeedsReport> {
    return buildNeedsReport(await loadSubmittedAnswers(ctx, campaignId));
}

/**
 * The needs report as CSV, a row per need.
 *
 * @throws NotFoundError if the self audit campaign isn't in the organization.
 */
export async function getNeedsReportCsv(
    ctx: OrgServiceContext,
    campaignId: SelfAuditCampaignId,
): Promise<string> {
    return needsReportCsv(await loadSubmittedAnswers(ctx, campaignId));
}

// Create

/**
 * Create a Draft self audit campaign of the bundle, pinned to the team: the team's D4H link and the
 * bundle's templates for that D4H team are snapshotted (decision 5 of the campaigns plan), and it
 * has no members yet. Without a name, it's named after the bundle and the month, in the
 * organization's time zone. Logged as one entry.
 *
 * @throws NotFoundError if the team or the bundle isn't in the organization, or the token doesn't
 * reach the team's D4H team.
 * @throws ValidationError if the team isn't Active or has no D4H link, or the bundle is Deleted.
 */
export async function createCampaign(
    ctx: OrgServiceContext,
    {
        accessToken,
        teamId,
        bundleId,
        name,
    }: {
        accessToken: D4HAccessToken_ServerOnly;
        teamId: TeamId;
        bundleId: I3BundleId;
        name?: string;
    },
): Promise<{ campaignId: SelfAuditCampaignId }> {
    const team = await ctx.prisma.team.findFirst({
        where: { id: teamId, organizationId: ctx.organizationId },
        select: {
            id: true,
            name: true,
            status: true,
            d4h: { select: { d4hTeamId: true, d4hTeamName: true } },
        },
    });
    if (!team) throw new NotFoundError(`Team(id=${teamId}) not found.`);
    if (team.status !== "Active") throw new ValidationError(`${team.name} isn't active.`);
    if (!team.d4h) throw new ValidationError(`${team.name} isn't linked to a D4H team.`);
    const { d4hTeamId, d4hTeamName } = team.d4h;

    const [{ bundle, templates }, settings] = await Promise.all([
        snapshotTemplates(ctx, { accessToken, bundleId, d4hTeamId }),
        OrgSettings.read(ctx.prisma, ctx.organizationId),
    ]);
    const campaignName =
        name?.trim() || defaultCampaignName(bundle.name, settings.general.timeZone);

    const campaignId = SelfAuditCampaignId.create();
    await ctx.prisma.$transaction([
        ctx.prisma.selfAuditCampaign.create({
            data: {
                id: campaignId,
                organizationId: ctx.organizationId,
                name: campaignName,
                teamId: team.id,
                d4hTeamId,
                d4hTeamName,
                bundleId: bundle.id,
                bundleName: bundle.name,
                templates,
            },
        }),
        ctx.logEvent({
            action: "Create",
            objectType: "SelfAuditCampaign",
            objectId: campaignId,
            description: `Self Audit Campaign ${campaignName}: ${bundle.name} for ${team.name}`,
            refs: [
                { objectType: "I3Bundle", objectId: bundle.id, role: "context" },
                { objectType: "Team", objectId: team.id, role: "context" },
            ],
        }),
    ]);
    return { campaignId };
}

// Send

/** The pause between two sends, so one self audit campaign doesn't burst Resend (decision 14). */
export const SEND_SPACING_MS = 500;

/**
 * The timeout of a transaction that writes once or a few times per member (send's claim, add):
 * Prisma's 5 s default is too short for `SELF_AUDIT_RECIPIENTS_MAX` members, so it allows 100 ms
 * per member on top of the default.
 */
const MEMBER_WRITES_TIMEOUT_MS = 5_000 + SELF_AUDIT_RECIPIENTS_MAX * 100;

/** The fallback for who's asking, when the sender's account is gone. */
const UNKNOWN_SENDER = "The team equipment officer";

/** What a send reaches outside the database, injected so tests can stand in for it. */
export interface SelfAuditSendDeps {
    sendEmail: typeof sendEmail;
    sleep: (ms: number) => Promise<void>;
    createLinkToken: typeof createLinkToken;
}

export const defaultSelfAuditSendDeps: SelfAuditSendDeps = {
    sendEmail,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    createLinkToken,
};

/** What every email of one self audit campaign shares. */
type SelfAuditSendContext = {
    organizationName: string;
    /** The form link's first segment: `/forms/<slug>/d4h-i3-self-audit/<token>`. */
    organizationSlug: string;
    bundleName: string;
    /** The campaign's D4H team, as linked at create. */
    teamName: string;
    requestedBy: string;
    timeZone: string;
    replyTo: string | undefined;
};

/** A request, as the send step reads it. */
type SendableRequest = {
    id: SelfAuditRequestId;
    email: string;
    memberName: string;
};

/** The organization's name, slug, time zone and Reply-To, and the caller's name as the sender. */
async function loadSendContext(
    ctx: OrgServiceContext,
    campaign: { bundleName: string; teamName: string },
): Promise<SelfAuditSendContext> {
    const [organization, sender, settings] = await Promise.all([
        ctx.prisma.organization.findUniqueOrThrow({
            where: { id: ctx.organizationId },
            select: { name: true, slug: true },
        }),
        ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
        OrgSettings.read(ctx.prisma, ctx.organizationId),
    ]);
    return {
        organizationName: organization.name,
        organizationSlug: organization.slug,
        ...campaign,
        requestedBy: sender?.name || UNKNOWN_SENDER,
        timeZone: settings.general.timeZone,
        replyTo: orgReplyTo(settings),
    };
}

/**
 * Send one request's link: a fresh token, valid for `SELF_AUDIT_TOKEN_DAYS`, replacing any earlier
 * one (decision 1). Shared by send, add and resend. A withdrawn request is skipped: nothing is
 * written or sent, and the outcome is `Withdrawn`.
 *
 * The hash and expiry go on (`Pending`) just before the send, as in the nag runner, so the link
 * works even if the `Sent` write is lost: then it stays `Pending` and still counts as sent. On
 * success the request is `Sent` with a new `sentAt`; on failure it's `Failed` with no token. Either
 * way the outcome is logged with its write. Progress and answers are never touched (decision 13).
 */
async function sendRequest(
    ctx: OrgServiceContext,
    request: SendableRequest,
    send: SelfAuditSendContext,
    deps: SelfAuditSendDeps,
): Promise<"Sent" | "Failed" | "Withdrawn"> {
    const link = deps.createLinkToken();
    const expiresAt = addDays(new Date(), SELF_AUDIT_TOKEN_DAYS);
    // Only while not withdrawn (decision 6 of the campaigns plan): a member withdrawn since the
    // send read them gets no link, and no email.
    const { count } = await ctx.prisma.selfAuditRequest.updateMany({
        where: { id: request.id, organizationId: ctx.organizationId, withdrawnAt: null },
        data: { tokenHash: link.hash, expiresAt, deliveryStatus: "Pending" },
    });
    if (count === 0) return "Withdrawn";

    const result = await deps.sendEmail({
        from: NoReplyEmailAddress,
        to: request.email,
        ...(send.replyTo !== undefined && { replyTo: send.replyTo }),
        subject: selfAuditRequestSubject({ name: send.bundleName }),
        react: SelfAuditRequestEmail({
            organization: { name: send.organizationName },
            member: { name: request.memberName },
            team: { name: send.teamName },
            bundle: { name: send.bundleName },
            requestedBy: send.requestedBy,
            formUrl: `${baseUrl}/forms/${send.organizationSlug}/d4h-i3-self-audit/${link.token}`,
            expiresAt,
            timeZone: send.timeZone,
            recipientEmail: request.email,
        }),
    });

    if (result.ok) {
        const markSent = () =>
            ctx.prisma.$transaction([
                ctx.prisma.selfAuditRequest.update({
                    where: { id: request.id, organizationId: ctx.organizationId },
                    data: { deliveryStatus: "Sent", sentAt: new Date() },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "SelfAuditRequest",
                    objectId: request.id,
                    description: `Self-audit sent to ${request.memberName} (${request.email})`,
                }),
            ]);
        // Retried once, as the nag runner's `markSent` is: the email has gone. If both fail, the
        // request stays `Pending` with its live token, so the link it was sent still works.
        await markSent()
            .catch(() => markSent())
            .catch((error: unknown) => {
                console.error(
                    `Self-audit request ${request.id}: email sent, but the Sent write failed`,
                    error,
                );
            });
        return "Sent";
    }

    await markFailed(ctx, request);
    return "Failed";
}

/** Mark a request `Failed`, its token cleared, logging the outcome with the write. */
async function markFailed(ctx: OrgServiceContext, request: SendableRequest): Promise<void> {
    await ctx.prisma.$transaction([
        ctx.prisma.selfAuditRequest.update({
            where: { id: request.id, organizationId: ctx.organizationId },
            data: { deliveryStatus: "Failed", tokenHash: null, expiresAt: null },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "SelfAuditRequest",
            objectId: request.id,
            description: `Self-audit failed to send to ${request.memberName} (${request.email})`,
        }),
    ]);
}

/**
 * Send each request its link in turn, `SEND_SPACING_MS` apart; one failure marks that request
 * `Failed` and the rest carry on (decision 14). Pass a context bound to the send's batch.
 */
async function sendRequests(
    ctx: OrgServiceContext,
    requests: readonly SendableRequest[],
    send: SelfAuditSendContext,
    deps: SelfAuditSendDeps,
): Promise<{ sent: number; failed: number; withdrawn: number }> {
    const result = { sent: 0, failed: 0, withdrawn: 0 };
    for (const [index, request] of requests.entries()) {
        // Spacing goes between sends, not before the first.
        if (index > 0) await deps.sleep(SEND_SPACING_MS);
        try {
            const outcome = await sendRequest(ctx, request, send, deps);
            if (outcome === "Sent") result.sent++;
            else if (outcome === "Withdrawn") result.withdrawn++;
            else result.failed++;
        } catch {
            // A database error mustn't stop the loop: the rest would stay `Pending`, and they'd
            // have to be resent one by one. Best effort: the database may still be failing.
            result.failed++;
            await markFailed(ctx, request).catch(() => {});
        }
    }
    return result;
}

/** How a self audit campaign's sends went. */
export type SelfAuditSendResult = {
    campaignId: SelfAuditCampaignId;
    sent: number;
    failed: number;
    /** Members not sent one because D4H, refreshed at send, has no email for them. */
    noEmail: number;
};

/**
 * Send a Draft self audit campaign: email each member their link (decision 10 of the campaigns
 * plan).
 *
 * A Draft may sit for days, so each member's name and email are first refreshed from the
 * campaign's D4H team, read fresh from D4H as the caller's token sees it: `Unsent` and `NoEmail`
 * members alike, so one whose email was added in D4H since is sent theirs, and one D4H no longer
 * has an email for becomes `NoEmail`. One no longer in the team keeps what they were added with.
 * Then one transaction claims the campaign (sets `sentAt` and `sentById`, only while it's still a
 * Draft), moves each member to `Pending` (or `NoEmail`), and opens the `self-audit-campaign-send`
 * batch that every entry joins. Only then are the links sent, one at a time. A send cut short
 * leaves the rest `Pending`, with no link, for `resendRequest`.
 *
 * @throws NotFoundError if the campaign isn't in the organization, or the token doesn't reach its
 * D4H team.
 * @throws ConflictError if the campaign has already been sent.
 * @throws ValidationError if it has no members, or D4H has an email for none of them; nothing is
 * claimed or written.
 */
export async function sendCampaign(
    ctx: OrgServiceContext,
    {
        accessToken,
        campaignId,
    }: { accessToken: D4HAccessToken_ServerOnly; campaignId: SelfAuditCampaignId },
    deps: SelfAuditSendDeps = defaultSelfAuditSendDeps,
): Promise<SelfAuditSendResult> {
    /** The members a send refreshes and sends to: on a Draft, every one. */
    const toSendWhere = {
        deliveryStatus: { in: ["Unsent", "NoEmail"] },
        withdrawnAt: null,
    } satisfies Prisma.SelfAuditRequestWhereInput;
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: {
            name: true,
            bundleName: true,
            d4hTeamId: true,
            d4hTeamName: true,
            sentAt: true,
            requests: { where: toSendWhere, select: { id: true } },
        },
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);
    const alreadySent = () =>
        new ConflictError(`Self Audit Campaign ${campaign.name} has already been sent.`);
    const noMembers = () =>
        new ValidationError("Add members to the Self Audit Campaign before sending it.");
    if (campaign.sentAt !== null) throw alreadySent();
    if (campaign.requests.length === 0) throw noMembers();

    await requireReachableD4HTeam(accessToken, campaign.d4hTeamId);
    // Read fresh: the links must go to the addresses D4H has now.
    const credentialRef = toD4HCredentialRef(accessToken);
    expireD4HTeamMembers(credentialRef, campaign.d4hTeamId);
    const members = await getD4HTeamMembers(credentialRef, campaign.d4hTeamId);
    const memberById = new Map(members.map((member) => [member.id, member]));

    const { batchId, claimed } = await ctx.prisma.$transaction(
        async (tx) => {
            const claim = await tx.selfAuditCampaign.updateMany({
                where: { id: campaignId, organizationId: ctx.organizationId, sentAt: null },
                data: { sentAt: new Date(), sentById: ctx.userId },
            });
            if (claim.count === 0) throw alreadySent();

            // Read under the claim: a member added to the Draft after the first read is sent
            // too, and one removed since isn't.
            const toSend = await tx.selfAuditRequest.findMany({
                where: { campaignId, ...toSendWhere },
                select: { id: true, d4hMemberId: true, memberName: true, email: true },
            });
            // Thrown, so the claim rolls back and the campaign stays a Draft.
            if (toSend.length === 0) throw noMembers();
            const refreshed = toSend.map((request) => {
                const member = memberById.get(request.d4hMemberId);
                const memberName = member ? member.name : request.memberName;
                const email = member ? emailOf(member) : request.email;
                return {
                    id: SelfAuditRequestId.schema.parse(request.id),
                    memberName,
                    email,
                    changed: memberName !== request.memberName || email !== request.email,
                };
            });
            if (refreshed.every((request) => request.email === null)) {
                throw new ValidationError(
                    `D4H has no email for any member of Self Audit Campaign ${campaign.name}, so it can't be sent to anyone.`,
                );
            }

            const batch = await createLogBatch(
                { operationKey: "self-audit-campaign-send", userId: ctx.userId },
                tx,
            );
            const batchCtx = withBatch(ctx, batch.id);

            // A write per member D4H changed; the statuses in one write per outcome.
            for (const request of refreshed) {
                if (!request.changed) continue;
                await tx.selfAuditRequest.update({
                    where: { id: request.id },
                    data: { memberName: request.memberName, email: request.email },
                });
            }
            const withEmail = refreshed.filter((request) => request.email !== null);
            const withoutEmail = refreshed.filter((request) => request.email === null);
            for (const [deliveryStatus, requests] of [
                ["Pending", withEmail],
                ["NoEmail", withoutEmail],
            ] as const) {
                if (requests.length === 0) continue;
                await tx.selfAuditRequest.updateMany({
                    where: { id: { in: requests.map((request) => request.id) } },
                    data: { deliveryStatus },
                });
            }
            for (const request of withoutEmail) {
                await batchCtx.logEvent(
                    {
                        action: "Update",
                        objectType: "SelfAuditRequest",
                        objectId: request.id,
                        description: `Self-audit not sent to ${request.memberName}: no email in D4H`,
                    },
                    tx,
                );
            }
            await batchCtx.logEvent(
                {
                    action: "Update",
                    objectType: "SelfAuditCampaign",
                    objectId: campaignId,
                    description: `Self Audit Campaign ${campaign.name} sent to ${campaign.d4hTeamName}`,
                },
                tx,
            );
            return { batchId: batch.id, claimed: refreshed };
        },
        { timeout: MEMBER_WRITES_TIMEOUT_MS },
    );

    const sendable = claimed.flatMap(({ id, memberName, email }): SendableRequest[] =>
        email === null ? [] : [{ id, memberName, email }],
    );
    const send = await loadSendContext(ctx, {
        bundleName: campaign.bundleName,
        teamName: campaign.d4hTeamName,
    });
    const { sent, failed } = await sendRequests(withBatch(ctx, batchId), sendable, send, deps);
    return { campaignId, sent, failed, noEmail: claimed.length - sendable.length };
}

// Resend

/** How a resend went, and the self audit campaign it belongs to. */
export type SelfAuditResendResult = {
    campaignId: SelfAuditCampaignId;
    deliveryStatus: "Sent" | "Failed";
};

/**
 * Send a request's link again: a new token with a fresh `SELF_AUDIT_TOKEN_DAYS`, replacing the old
 * one, so the old link stops working (decision 1). Allowed for a sent request with an email,
 * `Pending` included, for a send that never finished; not for a Draft's `Unsent` member, who gets
 * theirs when the campaign is sent, nor a withdrawn one (decision 6 of the campaigns plan).
 *
 * Resend keeps the draft (decision 13): the form instance, its answers, `submittedData` and the
 * progress timestamps are left alone, so the member picks up where they left off. A failed resend
 * only marks the request `Failed` and clears its token. The outcome is logged under its own
 * `self-audit-campaign-send` batch (decision 11).
 *
 * @throws NotFoundError if the request isn't in the organization.
 * @throws ValidationError if the request has no email (`NoEmail`), isn't sent yet (`Unsent`), or
 * is withdrawn.
 */
export async function resendRequest(
    ctx: OrgServiceContext,
    requestId: SelfAuditRequestId,
    deps: SelfAuditSendDeps = defaultSelfAuditSendDeps,
): Promise<SelfAuditResendResult> {
    const request = await ctx.prisma.selfAuditRequest.findFirst({
        where: { id: requestId, organizationId: ctx.organizationId },
        select: {
            campaignId: true,
            email: true,
            memberName: true,
            deliveryStatus: true,
            withdrawnAt: true,
            campaign: { select: { bundleName: true, d4hTeamName: true } },
        },
    });
    if (!request) throw new NotFoundError(`SelfAuditRequest(id=${requestId}) not found.`);
    if (request.withdrawnAt !== null) {
        throw new ValidationError(
            `${request.memberName} is withdrawn; re-add them to send them a link again.`,
        );
    }
    if (request.deliveryStatus === "Unsent") {
        throw new ValidationError(
            `${request.memberName} gets their link when the Self Audit Campaign is sent.`,
        );
    }
    if (request.deliveryStatus === "NoEmail" || request.email === null) {
        throw new ValidationError(
            `${request.memberName} has no email in D4H, so their self-audit can't be sent.`,
        );
    }

    const batch = await createLogBatch(
        { operationKey: "self-audit-campaign-send", userId: ctx.userId },
        ctx.prisma,
    );
    const send = await loadSendContext(ctx, {
        bundleName: request.campaign.bundleName,
        teamName: request.campaign.d4hTeamName,
    });
    const deliveryStatus = await sendRequest(
        withBatch(ctx, batch.id),
        { id: requestId, email: request.email, memberName: request.memberName },
        send,
        deps,
    );
    // Withdrawn between the read and the send: nothing was written or sent.
    if (deliveryStatus === "Withdrawn") {
        throw new ValidationError(`${request.memberName} has been withdrawn.`);
    }
    return { campaignId: SelfAuditCampaignId.schema.parse(request.campaignId), deliveryStatus };
}

// Members: add, remove, withdraw

/**
 * Lock the campaign row for this transaction, while it's still in the state it was read in
 * (`sentAt` unchanged: a Draft still a Draft). A send claims the same row, so a Draft's member
 * change and its send can't interleave: a change made first is seen by the send, and one made
 * after is refused.
 *
 * @throws ConflictError if the campaign was sent (or discarded) since it was read.
 */
async function lockCampaign(
    ctx: OrgServiceContext,
    tx: Prisma.TransactionClient,
    campaign: { id: SelfAuditCampaignId; name: string; sentAt: Date | null },
): Promise<void> {
    const { count } = await tx.selfAuditCampaign.updateMany({
        where: { id: campaign.id, organizationId: ctx.organizationId, sentAt: campaign.sentAt },
        data: { updatedAt: new Date() },
    });
    if (count === 0) {
        throw new ConflictError(
            `Self Audit Campaign ${campaign.name} changed meanwhile. Refresh and try again.`,
        );
    }
}

/**
 * Snapshot what each current member of a campaign's D4H team would be asked, against the
 * campaign's stored templates (decision 7 of the campaigns plan), not the bundle as it is now: a
 * member added later is asked about the same templates as everyone else.
 *
 * Each stored template is matched by its I3 template's current D4H type and rules. One since
 * deleted, or since unlinked from D4H, matches no items. Only the variants the stored template
 * offers are offered, so a held item's `variantId` is always one the member can pick.
 *
 * With `fresh`, the team's members are read from D4H rather than the hours-long cache.
 *
 * @throws NotFoundError if the token doesn't reach the D4H team.
 */
async function snapshotCampaignMembers(
    ctx: OrgServiceContext,
    {
        accessToken,
        d4hTeamId,
        templates,
        fresh = false,
    }: {
        accessToken: D4HAccessToken_ServerOnly;
        d4hTeamId: number;
        templates: readonly SelfAuditTemplate[];
        fresh?: boolean;
    },
): Promise<SelfAuditMemberSnapshot<SelfAuditRecipient>[]> {
    const credentialRef = toD4HCredentialRef(accessToken);
    await requireReachableD4HTeam(accessToken, d4hTeamId);
    if (fresh) expireD4HTeamMembers(credentialRef, d4hTeamId);

    const [records, items, members] = await Promise.all([
        ctx.prisma.i3Template.findMany({
            where: {
                id: { in: templates.map((template) => template.id) },
                organizationId: ctx.organizationId,
            },
            include: { d4h: true, variants: { include: { d4h: true } } },
        }),
        fetchD4HTeamEquipmentItems(accessToken, d4hTeamId),
        getD4HTeamMembers(credentialRef, d4hTeamId),
    ]);
    const recordById = new Map(records.map((record) => [record.id, record]));

    // In the stored order, the order the campaign's templates were snapshotted in: an item
    // matching two templates is listed under the first, as at create.
    const lines = templates.flatMap((template): I3BundleLine[] => {
        const record = recordById.get(template.id);
        if (!record) return [];
        return [
            I3BundleLine.schema.parse({
                template: {
                    id: record.id,
                    name: record.name,
                    status: record.status,
                    d4h: record.d4h
                        ? {
                              categoryId: record.d4h.categoryId,
                              categoryTitle: record.d4h.categoryTitle,
                              kindId: record.d4h.kindId,
                              kindTitle: record.d4h.kindTitle,
                              requireSN: record.d4h.requireSN,
                              brandModelRule: record.d4h.brandModelRule,
                          }
                        : null,
                    variants: record.variants.flatMap((variant) =>
                        variant.d4h
                            ? [{ brandId: variant.d4h.brandId, modelId: variant.d4h.modelId }]
                            : [],
                    ),
                },
            }),
        ];
    });
    const variantSources = records.flatMap((record) =>
        record.variants.map(
            (variant): SelfAuditVariantSource => ({
                id: variant.id,
                templateId: variant.templateId,
                name: variant.name,
                d4h: variant.d4h
                    ? { brandId: variant.d4h.brandId, modelId: variant.d4h.modelId }
                    : null,
            }),
        ),
    );

    const issued = filterTeamIssuedItems(items, d4hTeamId).map(
        ({ item, holderId }): SelfAuditIssuedItem => ({ ...item, holder: { id: holderId } }),
    );
    const recipients = members.map(
        (member): SelfAuditRecipient => ({
            id: member.id,
            name: member.name,
            email: emailOf(member),
        }),
    );

    const comparison = compareBundle({
        lines,
        members: recipients,
        items: issued,
        // The stored templates fitted the team when the campaign was created.
        fittingTemplateIds: templates.map((template) => template.id),
    });
    return buildSelfAuditSnapshot({
        columns: comparison.columns,
        rows: comparison.rows,
        variants: variantSources,
        fittingVariantIds: templates.flatMap((template) =>
            template.variants.map((variant) => variant.id),
        ),
    }).members;
}

/** A D4H member who can be added to a self audit campaign. */
export type SelfAuditAddableMember = {
    d4hMemberId: number;
    name: string;
    /** Trimmed; `null` when D4H has none. */
    email: string | null;
    /** Set when they're a withdrawn member: adding them re-adds that request. */
    withdrawnRequestId: SelfAuditRequestId | null;
};

/**
 * The members of the campaign's D4H team (as snapshotted at create, decision 7 of the campaigns
 * plan) who can be added, by name: those not in the campaign, and those withdrawn from it. A
 * withdrawn member no longer in the D4H team isn't listed, since re-adding refreshes them from it.
 *
 * @throws NotFoundError if the campaign isn't in the organization, or the token doesn't reach its
 * D4H team.
 */
export async function listAddableMembers(
    ctx: OrgServiceContext,
    {
        accessToken,
        campaignId,
    }: { accessToken: D4HAccessToken_ServerOnly; campaignId: SelfAuditCampaignId },
): Promise<SelfAuditAddableMember[]> {
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: {
            d4hTeamId: true,
            requests: { select: { id: true, d4hMemberId: true, withdrawnAt: true } },
        },
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);

    await requireReachableD4HTeam(accessToken, campaign.d4hTeamId);
    const members = await getD4HTeamMembers(toD4HCredentialRef(accessToken), campaign.d4hTeamId);
    const requestByMember = new Map(
        campaign.requests.map((request) => [request.d4hMemberId, request]),
    );

    return members
        .flatMap((member): SelfAuditAddableMember[] => {
            const request = requestByMember.get(member.id);
            if (request && request.withdrawnAt === null) return [];
            return [
                {
                    d4hMemberId: member.id,
                    name: member.name,
                    email: emailOf(member),
                    withdrawnRequestId: request
                        ? SelfAuditRequestId.schema.parse(request.id)
                        : null,
                },
            ];
        })
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** A campaign's request, as adding members checks it. */
type AddCheckRequest = {
    id: string;
    d4hMemberId: number;
    memberName: string;
    withdrawnAt: Date | null;
};

/**
 * Check the members can be added to a campaign with these requests, and map each to its request.
 *
 * @throws ValidationError if no member is given, one is already in the campaign (and not
 * withdrawn), or the campaign would go over `SELF_AUDIT_RECIPIENTS_MAX` members.
 */
function checkAddable(
    requests: readonly AddCheckRequest[],
    memberIds: readonly number[],
): Map<number, AddCheckRequest> {
    if (memberIds.length === 0) {
        throw new ValidationError("Choose at least one member to add.");
    }
    const requestByMember = new Map(requests.map((request) => [request.d4hMemberId, request]));
    for (const memberId of memberIds) {
        const request = requestByMember.get(memberId);
        if (request && request.withdrawnAt === null) {
            throw new ValidationError(
                `${request.memberName} is already in the Self Audit Campaign.`,
            );
        }
    }
    const current = requests.filter((request) => request.withdrawnAt === null).length;
    if (current + memberIds.length > SELF_AUDIT_RECIPIENTS_MAX) {
        throw new ValidationError(
            `A Self Audit Campaign can have at most ${SELF_AUDIT_RECIPIENTS_MAX} members; it has ${current}, and ${memberIds.length} are chosen.`,
        );
    }
    return requestByMember;
}

/** How adding members went. */
export type SelfAuditAddResult = {
    campaignId: SelfAuditCampaignId;
    /** New members and re-added ones. */
    added: number;
    /** Emailed now: only on a sent campaign. */
    sent: number;
    failed: number;
    /** Added with no email in D4H, so not emailed. */
    noEmail: number;
};

/**
 * Add members of the campaign's D4H team to it (decisions 7 and 10 of the campaigns plan). Members
 * and their held items come from the D4H team snapshotted at create, held items against the
 * campaign's stored templates (`snapshotCampaignMembers`).
 *
 * - **A new member** gets a Draft `FormInstance` with the pre-filled answer and a request.
 * - **A withdrawn member** is re-added: the same request, `withdrawnAt` cleared and their name
 *   and email refreshed from D4H. Their held items, answers and progress are kept.
 *
 * On a Draft they're `Unsent` (no link yet) and nobody is emailed. On a sent campaign they're
 * `Pending` and emailed at once, one at a time as a send is. Either way a member D4H has no email
 * for is `NoEmail`. Every entry joins one `self-audit-add-members` batch.
 *
 * @throws NotFoundError if the campaign isn't in the organization, or the token doesn't reach its
 * D4H team.
 * @throws ValidationError if no member is given, one is already in the campaign (and not
 * withdrawn), one isn't in the D4H team, or the campaign would go over `SELF_AUDIT_RECIPIENTS_MAX`
 * members (withdrawn ones not counted).
 * @throws ConflictError if the campaign was sent since it was read.
 */
export async function addMembers(
    ctx: OrgServiceContext,
    {
        accessToken,
        campaignId,
        d4hMemberIds,
    }: {
        accessToken: D4HAccessToken_ServerOnly;
        campaignId: SelfAuditCampaignId;
        d4hMemberIds: readonly number[];
    },
    deps: SelfAuditSendDeps = defaultSelfAuditSendDeps,
): Promise<SelfAuditAddResult> {
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: {
            name: true,
            bundleName: true,
            d4hTeamId: true,
            d4hTeamName: true,
            templates: true,
            sentAt: true,
            requests: {
                select: { id: true, d4hMemberId: true, memberName: true, withdrawnAt: true },
            },
        },
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);

    const memberIds = [...new Set(d4hMemberIds)];
    // Checked before D4H is read, and again under the lock (below).
    const firstRead = checkAddable(campaign.requests, memberIds);

    const snapshots = await snapshotCampaignMembers(ctx, {
        accessToken,
        d4hTeamId: campaign.d4hTeamId,
        templates: z.array(SelfAuditTemplate).parse(campaign.templates),
        // A re-added member's email is refreshed from D4H: read it fresh, so one just fixed
        // there is the one used.
        fresh: memberIds.some((memberId) => firstRead.has(memberId)),
    });
    const snapshotByMember = new Map(snapshots.map((snapshot) => [snapshot.member.id, snapshot]));
    const chosen = memberIds.map((memberId) => {
        const snapshot = snapshotByMember.get(memberId);
        if (!snapshot) {
            // Most likely they left the team since the list was read.
            throw new ValidationError(
                `D4H member ${memberId} isn't in ${campaign.d4hTeamName}. Refresh and try again.`,
            );
        }
        return snapshot;
    });

    const isDraft = campaign.sentAt === null;
    const campaignRef = {
        objectType: "SelfAuditCampaign",
        objectId: campaignId,
        role: "context",
    } as const;

    const { batchId, toSend } = await ctx.prisma.$transaction(
        async (tx) => {
            await lockCampaign(ctx, tx, { id: campaignId, ...campaign });
            // Read again under the lock: an add that ran meanwhile may have added one of these
            // members, re-added one, or brought the campaign near its cap.
            const requestByMember = checkAddable(
                await tx.selfAuditRequest.findMany({
                    where: { campaignId },
                    select: { id: true, d4hMemberId: true, memberName: true, withdrawnAt: true },
                }),
                memberIds,
            );
            const batch = await createLogBatch(
                { operationKey: "self-audit-add-members", userId: ctx.userId },
                tx,
            );
            const batchCtx = withBatch(ctx, batch.id);

            const added = chosen.map(({ member, heldItems, response }) => {
                const prior = requestByMember.get(member.id);
                const deliveryStatus: SelfAuditDeliveryStatus =
                    member.email === null ? "NoEmail" : isDraft ? "Unsent" : "Pending";
                return {
                    member,
                    heldItems,
                    response,
                    id: prior
                        ? SelfAuditRequestId.schema.parse(prior.id)
                        : SelfAuditRequestId.create(),
                    reAdded: prior !== undefined,
                    formInstanceId: FormInstanceId.create(),
                    deliveryStatus,
                };
            });
            const created = added.filter((entry) => !entry.reAdded);

            // Re-added: the held items stay, since the saved answers refer to them.
            for (const { id, member, deliveryStatus } of added.filter((entry) => entry.reAdded)) {
                await tx.selfAuditRequest.update({
                    where: { id, organizationId: ctx.organizationId },
                    data: {
                        withdrawnAt: null,
                        memberName: member.name,
                        email: member.email,
                        deliveryStatus,
                    },
                });
            }
            if (created.length > 0) {
                await tx.formInstance.createMany({
                    data: created.map(({ formInstanceId, response }) => ({
                        id: formInstanceId,
                        formKey: SelfAuditForm.formKey,
                        organizationId: ctx.organizationId,
                        userId: null,
                        formData: response,
                        formStatus: "Draft",
                    })),
                });
                await tx.selfAuditRequest.createMany({
                    data: created.map(
                        ({ id, member, heldItems, deliveryStatus, formInstanceId }) => ({
                            id,
                            organizationId: ctx.organizationId,
                            campaignId,
                            d4hMemberId: member.id,
                            memberName: member.name,
                            email: member.email,
                            heldItems,
                            deliveryStatus,
                            formInstanceId,
                        }),
                    ),
                });
            }
            for (const { id, member, reAdded } of added) {
                const noEmail = member.email === null ? ": no email in D4H" : "";
                await batchCtx.logEvent(
                    {
                        action: reAdded ? "Update" : "Create",
                        objectType: "SelfAuditRequest",
                        objectId: id,
                        description: reAdded
                            ? `Self-audit re-added for ${member.name}${noEmail}`
                            : `Self-audit for ${member.name}${noEmail}`,
                        refs: [campaignRef],
                    },
                    tx,
                );
            }

            const toSend = added.flatMap(({ id, member }): SendableRequest[] =>
                !isDraft && member.email !== null
                    ? [{ id, email: member.email, memberName: member.name }]
                    : [],
            );
            return { batchId: batch.id, toSend };
        },
        { timeout: MEMBER_WRITES_TIMEOUT_MS },
    );

    const noEmail = chosen.filter(({ member }) => member.email === null).length;
    if (toSend.length === 0) {
        return { campaignId, added: chosen.length, sent: 0, failed: 0, noEmail };
    }
    const send = await loadSendContext(ctx, {
        bundleName: campaign.bundleName,
        teamName: campaign.d4hTeamName,
    });
    const { sent, failed } = await sendRequests(withBatch(ctx, batchId), toSend, send, deps);
    return { campaignId, added: chosen.length, sent, failed, noEmail };
}

/**
 * Remove a member from a Draft: their request and its form instance are deleted (decision 10 of
 * the campaigns plan). Logged as one entry. Once sent, a member is withdrawn instead.
 *
 * @throws NotFoundError if the request isn't in the organization.
 * @throws ValidationError if the campaign has been sent.
 * @throws ConflictError if it was sent since it was read.
 */
export async function removeRequest(
    ctx: OrgServiceContext,
    requestId: SelfAuditRequestId,
): Promise<{ campaignId: SelfAuditCampaignId }> {
    const request = await ctx.prisma.selfAuditRequest.findFirst({
        where: { id: requestId, organizationId: ctx.organizationId },
        select: {
            campaignId: true,
            memberName: true,
            formInstanceId: true,
            campaign: { select: { name: true, sentAt: true } },
        },
    });
    if (!request) throw new NotFoundError(`SelfAuditRequest(id=${requestId}) not found.`);
    if (request.campaign.sentAt !== null) {
        throw new ValidationError(
            `Self Audit Campaign ${request.campaign.name} has been sent: withdraw ${request.memberName} instead.`,
        );
    }
    const campaignId = SelfAuditCampaignId.schema.parse(request.campaignId);

    await ctx.prisma.$transaction(async (tx) => {
        await lockCampaign(ctx, tx, { id: campaignId, ...request.campaign });
        await tx.selfAuditRequest.delete({
            where: { id: requestId, organizationId: ctx.organizationId },
        });
        await tx.formInstance.delete({ where: { id: request.formInstanceId } });
        await ctx.logEvent(
            {
                action: "Delete",
                objectType: "SelfAuditRequest",
                objectId: requestId,
                description: `Self-audit for ${request.memberName} removed`,
                refs: [{ objectType: "SelfAuditCampaign", objectId: campaignId, role: "context" }],
            },
            tx,
        );
    });
    return { campaignId };
}

/**
 * Withdraw a member from a sent campaign (decision 6 of the campaigns plan): their link is cleared
 * at once, so it stops working, and the request and any answers are kept. Logged as one entry.
 * Re-adding them (`addMembers`) is the only way back to a link.
 *
 * @throws NotFoundError if the request isn't in the organization.
 * @throws ValidationError if the campaign is a Draft (remove the member instead), or the member is
 * already withdrawn.
 */
export async function withdrawRequest(
    ctx: OrgServiceContext,
    requestId: SelfAuditRequestId,
): Promise<{ campaignId: SelfAuditCampaignId }> {
    const request = await ctx.prisma.selfAuditRequest.findFirst({
        where: { id: requestId, organizationId: ctx.organizationId },
        select: {
            campaignId: true,
            memberName: true,
            withdrawnAt: true,
            campaign: { select: { name: true, sentAt: true } },
        },
    });
    if (!request) throw new NotFoundError(`SelfAuditRequest(id=${requestId}) not found.`);
    if (request.campaign.sentAt === null) {
        throw new ValidationError(
            `Self Audit Campaign ${request.campaign.name} is a Draft: remove ${request.memberName} instead.`,
        );
    }
    if (request.withdrawnAt !== null) {
        throw new ValidationError(`${request.memberName} is already withdrawn.`);
    }
    const campaignId = SelfAuditCampaignId.schema.parse(request.campaignId);

    await ctx.prisma.$transaction(async (tx) => {
        // Only while not withdrawn: a withdraw that ran meanwhile isn't logged twice.
        const { count } = await tx.selfAuditRequest.updateMany({
            where: { id: requestId, organizationId: ctx.organizationId, withdrawnAt: null },
            data: { withdrawnAt: new Date(), tokenHash: null, expiresAt: null },
        });
        if (count === 0) {
            throw new ValidationError(`${request.memberName} is already withdrawn.`);
        }
        await ctx.logEvent(
            {
                action: "Update",
                objectType: "SelfAuditRequest",
                objectId: requestId,
                description: `Self-audit withdrawn from ${request.memberName}`,
                refs: [{ objectType: "SelfAuditCampaign", objectId: campaignId, role: "context" }],
            },
            tx,
        );
    });
    return { campaignId };
}

// Discard

/**
 * Discard a Draft (decision 10 of the campaigns plan): it's deleted with its requests and their
 * form instances. Logged as one entry. A sent campaign can't be discarded.
 *
 * @throws NotFoundError if the campaign isn't in the organization.
 * @throws ValidationError if it has been sent.
 * @throws ConflictError if it was sent since it was read.
 */
export async function discardCampaign(
    ctx: OrgServiceContext,
    campaignId: SelfAuditCampaignId,
): Promise<{ campaignId: SelfAuditCampaignId }> {
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: { name: true, sentAt: true },
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);
    if (campaign.sentAt !== null) {
        throw new ValidationError(
            `Self Audit Campaign ${campaign.name} has been sent, so it can't be discarded.`,
        );
    }

    await ctx.prisma.$transaction(async (tx) => {
        await lockCampaign(ctx, tx, { id: campaignId, ...campaign });
        // Read under the lock: a member added after the first read goes too.
        const requests = await tx.selfAuditRequest.findMany({
            where: { campaignId },
            select: { formInstanceId: true },
        });
        await tx.selfAuditRequest.deleteMany({ where: { campaignId } });
        await tx.formInstance.deleteMany({
            where: { id: { in: requests.map((request) => request.formInstanceId) } },
        });
        await tx.selfAuditCampaign.delete({
            where: { id: campaignId, organizationId: ctx.organizationId },
        });
        await ctx.logEvent(
            {
                action: "Delete",
                objectType: "SelfAuditCampaign",
                objectId: campaignId,
                description: `Self Audit Campaign ${campaign.name} discarded`,
            },
            tx,
        );
    });
    return { campaignId };
}
