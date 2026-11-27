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

import { addDays, format } from "date-fns";
import * as z from "zod";

import { TZDate } from "@date-fns/tz";

import { baseUrl } from "@/emails/base-url";
import SelfAuditRequestEmail, { selfAuditRequestSubject } from "@/emails/self-audit-request";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
    compareBundle,
    type BundleRow,
    type ComparableLine,
    type ExcludedReason,
} from "@/lib/i3-bundle-compare";
import type { ItemQualityResult } from "@/lib/i3-item-quality";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import type { I3Bundle, I3BundleId, I3BundleLine, I3BundleSummary } from "@/lib/schemas/i3-bundle";
import {
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
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";
import { toD4HCredentialRef } from "@/server/d4h-access-token";
import { getD4HTeamMembers, getD4HTokenMetadata } from "@/server/d4h-api/client";
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

/** A bundle line the comparison leaves out for a team, and why. */
export type SelfAuditExcludedLine = {
    templateId: string;
    name: string;
    reason: ExcludedReason;
};

export type SelfAuditTeamSnapshot = SelfAuditSnapshot<SelfAuditRecipient> & {
    excluded: SelfAuditExcludedLine[];
};

/**
 * Compare the bundle against one D4H team and snapshot what each member would be asked, as the
 * caller's D4H token sees it.
 *
 * @throws NotFoundError if the bundle isn't in the organization, or the token doesn't reach the team.
 * @throws ValidationError if the bundle is Deleted.
 */
export async function computeTeamSnapshot(
    ctx: OrgServiceContext,
    {
        accessToken,
        bundleId,
        d4hTeamId,
    }: { accessToken: D4HAccessToken_ServerOnly; bundleId: I3BundleId; d4hTeamId: number },
): Promise<{ bundle: I3Bundle; snapshot: SelfAuditTeamSnapshot }> {
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
    if (!d4HTeams.some((candidate) => candidate.id === d4hTeamId)) {
        throw new NotFoundError(`D4H team ${d4hTeamId} not found.`);
    }

    const variants = await ctx.prisma.i3TemplateVariant.findMany({
        where: { templateId: { in: lines.map((line) => line.template.id) } },
        include: { d4h: true },
    });
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

    const [fits, items, members] = await Promise.all([
        I3Templates.listFitsForD4HTeam(ctx, { accessToken, teamId: d4hTeamId }),
        fetchD4HTeamEquipmentItems(accessToken, d4hTeamId),
        getD4HTeamMembers(credentialRef, d4hTeamId),
    ]);

    const issued = filterTeamIssuedItems(items, d4hTeamId).map(
        ({ item, holderId }): SelfAuditIssuedItem => ({
            ...item,
            holder: { id: holderId },
        }),
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
        fittingTemplateIds: fits.templateIds,
    });

    const snapshot = buildSelfAuditSnapshot({
        columns: comparison.columns,
        rows: comparison.rows,
        variants: variantSources,
        fittingVariantIds: fits.variantIds,
    });

    return {
        bundle,
        snapshot: {
            ...snapshot,
            excluded: comparison.excluded.map(({ line, reason }) => ({
                templateId: line.template.id,
                name: line.template.name,
                reason,
            })),
        },
    };
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

// Create

/** A campaign's name when none is given: `<bundle name> <Mon YYYY>`, the month in `timeZone`. */
export function defaultCampaignName(bundleName: string, timeZone: string, now = new Date()) {
    return `${bundleName} ${format(new TZDate(now, timeZone), "MMM yyyy")}`;
}

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

    const [{ bundle, snapshot }, settings] = await Promise.all([
        computeTeamSnapshot(ctx, { accessToken, bundleId, d4hTeamId }),
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
                templates: snapshot.templates,
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
 * one (decision 1). Shared by send and resend.
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
): Promise<"Sent" | "Failed"> {
    const link = deps.createLinkToken();
    const expiresAt = addDays(new Date(), SELF_AUDIT_TOKEN_DAYS);
    await ctx.prisma.selfAuditRequest.update({
        where: { id: request.id, organizationId: ctx.organizationId },
        data: { tokenHash: link.hash, expiresAt, deliveryStatus: "Pending" },
    });

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
): Promise<{ sent: number; failed: number }> {
    const result = { sent: 0, failed: 0 };
    for (const [index, request] of requests.entries()) {
        // Spacing goes between sends, not before the first.
        if (index > 0) await deps.sleep(SEND_SPACING_MS);
        try {
            const outcome = await sendRequest(ctx, request, send, deps);
            if (outcome === "Sent") result.sent++;
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
 * Send a Draft self audit campaign: email each `Unsent` member their link (decision 10 of the
 * campaigns plan).
 *
 * A Draft may sit for days, so each `Unsent` member's name and email are first refreshed from the
 * campaign's D4H team, as the caller's D4H token sees it; one D4H no longer has an email for becomes
 * `NoEmail`, and one no longer in the team keeps what they were added with. Then one transaction
 * claims the campaign (sets `sentAt` and `sentById`, only while it's still a Draft), moves each
 * `Unsent` request to `Pending` (or `NoEmail`), and opens the `self-audit-campaign-send` batch that
 * every entry joins. Only then are the links sent, one at a time. A send cut short leaves the rest
 * `Pending`, with no link, for `resendRequest`.
 *
 * @throws NotFoundError if the campaign isn't in the organization.
 * @throws ConflictError if the campaign has already been sent.
 * @throws ValidationError if it has no `Unsent` member to send to.
 */
export async function sendCampaign(
    ctx: OrgServiceContext,
    {
        accessToken,
        campaignId,
    }: { accessToken: D4HAccessToken_ServerOnly; campaignId: SelfAuditCampaignId },
    deps: SelfAuditSendDeps = defaultSelfAuditSendDeps,
): Promise<SelfAuditSendResult> {
    const campaign = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        select: {
            name: true,
            bundleName: true,
            d4hTeamId: true,
            d4hTeamName: true,
            sentAt: true,
            requests: { where: { deliveryStatus: "Unsent" }, select: { id: true } },
        },
    });
    if (!campaign) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);
    const alreadySent = () =>
        new ConflictError(`Self Audit Campaign ${campaign.name} has already been sent.`);
    if (campaign.sentAt !== null) throw alreadySent();
    if (campaign.requests.length === 0) {
        throw new ValidationError("Add members to the Self Audit Campaign before sending it.");
    }

    const members = await getD4HTeamMembers(toD4HCredentialRef(accessToken), campaign.d4hTeamId);
    const memberById = new Map(members.map((member) => [member.id, member]));

    const { batchId, claimed } = await ctx.prisma.$transaction(async (tx) => {
        const claim = await tx.selfAuditCampaign.updateMany({
            where: { id: campaignId, organizationId: ctx.organizationId, sentAt: null },
            data: { sentAt: new Date(), sentById: ctx.userId },
        });
        if (claim.count === 0) throw alreadySent();

        const batch = await createLogBatch(
            { operationKey: "self-audit-campaign-send", userId: ctx.userId },
            tx,
        );
        const batchCtx = withBatch(ctx, batch.id);

        // Read under the claim: a member added to the Draft after the first read is sent too.
        const unsent = await tx.selfAuditRequest.findMany({
            where: { campaignId, deliveryStatus: "Unsent" },
            select: { id: true, d4hMemberId: true, memberName: true, email: true },
        });
        const refreshed = unsent.map((request) => {
            const member = memberById.get(request.d4hMemberId);
            return {
                id: SelfAuditRequestId.schema.parse(request.id),
                memberName: member ? member.name : request.memberName,
                email: member ? emailOf(member) : request.email,
            };
        });
        for (const request of refreshed) {
            await tx.selfAuditRequest.update({
                where: { id: request.id },
                data: {
                    memberName: request.memberName,
                    email: request.email,
                    deliveryStatus: request.email === null ? "NoEmail" : "Pending",
                },
            });
            if (request.email === null) {
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
    });

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
 * one, so the old link stops working (decision 1). Allowed for any delivery but `NoEmail`,
 * `Pending` included, for a send that never finished.
 *
 * Resend keeps the draft (decision 13): the form instance, its answers, `submittedData` and the
 * progress timestamps are left alone, so the member picks up where they left off. A failed resend
 * only marks the request `Failed` and clears its token. The outcome is logged under its own
 * `self-audit-campaign-send` batch (decision 11).
 *
 * @throws NotFoundError if the request isn't in the organization.
 * @throws ValidationError if the request has no email (`NoEmail`).
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
            campaign: { select: { bundleName: true, d4hTeamName: true } },
        },
    });
    if (!request) throw new NotFoundError(`SelfAuditRequest(id=${requestId}) not found.`);
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
    return { campaignId: SelfAuditCampaignId.schema.parse(request.campaignId), deliveryStatus };
}
