/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Self Audit Campaigns: email each D4H member of the chosen teams their own self-audit form, built from an
 * I3 bundle and pre-filled from D4H. See `docs/plans/2026-11-25-kit-check-send.md`.
 *
 * What a member is asked is snapshotted at send (decisions 6 and 6a): per team, the bundle's
 * comparable lines as `SelfAuditTemplate`s, and per member, the items D4H records as issued to them
 * as `SelfAuditHeldItem`s, with a pre-filled answer.
 */

import "server-only";

import { addDays } from "date-fns";
import * as z from "zod";

import { baseUrl } from "@/emails/base-url";
import SelfAuditRequestEmail, { selfAuditRequestSubject } from "@/emails/self-audit-request";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { SelfAuditForm } from "@/lib/forms";
import {
    compareBundle,
    type BundleRow,
    type ComparableLine,
    type ExcludedReason,
} from "@/lib/i3-bundle-compare";
import type { ItemQualityResult } from "@/lib/i3-item-quality";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import type { D4HTeamRef } from "@/lib/schemas/d4h/team";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import type { I3Bundle, I3BundleId, I3BundleLine, I3BundleSummary } from "@/lib/schemas/i3-bundle";
import {
    SELF_AUDIT_RECIPIENTS_MAX,
    SELF_AUDIT_TOKEN_DAYS,
    SelfAuditCampaignId,
    SelfAuditD4HTeam,
    SelfAuditHeldItem,
    SelfAuditRequestId,
    SelfAuditResponseData,
    SelfAuditTemplatesByTeam,
    type SelfAuditAnswerData,
    type SelfAuditDeliveryStatus,
    type SelfAuditProblem,
    type SelfAuditProgress,
    type SelfAuditTeamChoice,
    type SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
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

/** A D4H member of a self audit campaign's team, with the email the form is sent to. */
export type SelfAuditRecipient = SelfAuditMemberSource & {
    /** Trimmed; `null` when D4H has none. */
    email: string | null;
};

/** A bundle line the comparison leaves out for a team, and why. */
export type SelfAuditExcludedLine = {
    templateId: string;
    name: string;
    reason: ExcludedReason;
};

export type SelfAuditTeamSnapshot = SelfAuditSnapshot<SelfAuditRecipient> & {
    team: SelfAuditD4HTeam;
    excluded: SelfAuditExcludedLine[];
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
): Promise<{ bundle: I3Bundle; teams: SelfAuditTeamSnapshot[] }> {
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
        (variant): SelfAuditVariantSource => ({
            id: variant.id,
            templateId: variant.templateId,
            name: variant.name,
            d4h: variant.d4h
                ? { brandId: variant.d4h.brandId, modelId: variant.d4h.modelId }
                : null,
        }),
    );

    const snapshots = await Promise.all(
        teams.map(async (team): Promise<SelfAuditTeamSnapshot> => {
            const [fits, items, members] = await Promise.all([
                I3Templates.listFitsForD4HTeam(ctx, { accessToken, teamId: team.id }),
                fetchD4HTeamEquipmentItems(accessToken, team.id),
                getD4HTeamMembers(credentialRef, team.id),
            ]);

            const issued = filterTeamIssuedItems(items, team.id).map(
                ({ item, holderId }): SelfAuditIssuedItem => ({
                    ...item,
                    holder: { id: holderId },
                }),
            );
            const recipients = members.map(
                (member): SelfAuditRecipient => ({
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

            const snapshot = buildSelfAuditSnapshot({
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
export type SelfAuditPreviewTeam = {
    team: SelfAuditD4HTeam;
    /** How many of the bundle's lines the team's members are asked about. */
    templateCount: number;
    members: (SelfAuditRecipient & { heldCount: number })[];
    excluded: SelfAuditExcludedLine[];
};

/**
 * Who a self audit campaign would go to: per team, its members with their email and how many of the
 * bundle's lines they hold, and the lines the comparison leaves out and why.
 *
 * @throws NotFoundError if the bundle isn't in the organization, or the token doesn't reach a team.
 * @throws ValidationError if the bundle is Deleted.
 */
export async function previewRecipients(
    ctx: OrgServiceContext,
    input: { accessToken: D4HAccessToken_ServerOnly; bundleId: I3BundleId; d4hTeamIds: number[] },
): Promise<SelfAuditPreviewTeam[]> {
    const { teams } = await computeTeamSnapshots(ctx, input);

    return teams.map(({ team, templates, members, excluded }) => ({
        team,
        templateCount: templates.length,
        members: members.map(({ member, heldCount }) => ({ ...member, heldCount })),
        excluded,
    }));
}

// Admin reads

/** A request's progress (`SelfAuditProgress`): `Editing` is submitted, then reopened. */
export function progressOf(request: {
    openedAt: Date | null;
    submittedAt: Date | null;
    formStatus: string;
}): SelfAuditProgress {
    if (request.formStatus === "Submitted") return "Submitted";
    if (request.submittedAt !== null) return "Editing";
    if (request.openedAt !== null) return "Opened";
    return "NotOpened";
}

/** How many of a self audit campaign's requests are in each delivery status and each progress state. */
export type SelfAuditCampaignCounts = {
    delivery: Record<SelfAuditDeliveryStatus, number>;
    progress: Record<SelfAuditProgress, number>;
};

function countRequests(requests: readonly SelfAuditRequestSummary[]): SelfAuditCampaignCounts {
    const counts: SelfAuditCampaignCounts = {
        delivery: { Pending: 0, Sent: 0, Failed: 0, NoEmail: 0 },
        progress: { NotOpened: 0, Opened: 0, Submitted: 0, Editing: 0 },
    };
    for (const request of requests) {
        counts.delivery[request.deliveryStatus]++;
        counts.progress[request.progress]++;
    }
    return counts;
}

/** A self audit campaign, as its list row and its page header show it. */
export type SelfAuditCampaignSummary = {
    id: SelfAuditCampaignId;
    bundleName: string;
    d4hTeams: SelfAuditD4HTeam[];
    /** Null once the sender's account is purged. */
    sentByName: string | null;
    createdAt: Date;
    counts: SelfAuditCampaignCounts;
};

/** One member's request, as a self audit campaign's page shows it. Never carries the token hash. */
export type SelfAuditRequestSummary = {
    id: SelfAuditRequestId;
    d4hTeamId: number;
    d4hTeamTitle: string;
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
    progress: SelfAuditProgress;
};

/** A request as the admin pages read it: everything but the token hash and the answers. */
const requestSelect = {
    id: true,
    d4hTeamId: true,
    d4hTeamTitle: true,
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
type RequestRecord = Omit<SelfAuditRequestSummary, "id" | "formStatus" | "progress"> & {
    id: string;
    formInstance: { formStatus: string };
};

function toRequestSummary({ formInstance, ...request }: RequestRecord): SelfAuditRequestSummary {
    const { formStatus } = formInstance;
    return {
        ...request,
        id: SelfAuditRequestId.schema.parse(request.id),
        formStatus,
        progress: progressOf({ ...request, formStatus }),
    };
}

function toCampaignSummary(
    check: {
        id: string;
        bundleName: string;
        d4hTeams: unknown;
        createdAt: Date;
        sentBy: { name: string } | null;
    },
    requests: readonly SelfAuditRequestSummary[],
): SelfAuditCampaignSummary {
    return {
        id: SelfAuditCampaignId.schema.parse(check.id),
        bundleName: check.bundleName,
        d4hTeams: z.array(SelfAuditD4HTeam).parse(check.d4hTeams),
        sentByName: check.sentBy?.name ?? null,
        createdAt: check.createdAt,
        counts: countRequests(requests),
    };
}

/** The organization's self audit campaigns, newest first, each with its counts by delivery and progress. */
export async function listCampaigns(ctx: OrgServiceContext): Promise<SelfAuditCampaignSummary[]> {
    const checks = await ctx.prisma.selfAuditCampaign.findMany({
        where: { organizationId: ctx.organizationId },
        include: {
            sentBy: { select: { name: true } },
            requests: { select: requestSelect },
        },
        orderBy: { createdAt: "desc" },
    });

    return checks.map(({ requests, ...check }) =>
        toCampaignSummary(check, requests.map(toRequestSummary)),
    );
}

/**
 * A self audit campaign with its requests, by team and then member name.
 *
 * @throws NotFoundError if the self audit campaign isn't in the organization.
 */
export async function requireCampaignById(
    ctx: OrgServiceContext,
    campaignId: SelfAuditCampaignId,
): Promise<SelfAuditCampaignSummary & { requests: SelfAuditRequestSummary[] }> {
    const check = await ctx.prisma.selfAuditCampaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organizationId },
        include: {
            sentBy: { select: { name: true } },
            requests: { select: requestSelect },
        },
    });
    if (!check) throw new NotFoundError(`SelfAuditCampaign(id=${campaignId}) not found.`);

    const requests = check.requests
        .map(toRequestSummary)
        .toSorted(
            (a, b) =>
                a.d4hTeamTitle.localeCompare(b.d4hTeamTitle) ||
                a.memberName.localeCompare(b.memberName),
        );
    return { ...toCampaignSummary(check, requests), requests };
}

/** What a member was asked, and what they've answered. */
export type SelfAuditAnswers = {
    /** The request's team's templates, as snapshotted at send (decision 6a). */
    templates: SelfAuditTemplate[];
    heldItems: SelfAuditHeldItem[];
    /** The last submitted answer (decision 10); null until the first submit. */
    submittedData: SelfAuditResponseData | null;
    /** The working copy. */
    formData: SelfAuditResponseData;
    formStatus: string;
};

/**
 * A request's snapshot and answers: what the track page's answers dialog shows.
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
            d4hTeamId: true,
            heldItems: true,
            submittedData: true,
            campaign: { select: { templates: true } },
            formInstance: { select: { formData: true, formStatus: true } },
        },
    });
    if (!request) throw new NotFoundError(`SelfAuditRequest(id=${requestId}) not found.`);

    const templatesByTeam = SelfAuditTemplatesByTeam.parse(request.campaign.templates);
    return {
        templates: templatesByTeam[String(request.d4hTeamId)] ?? [],
        heldItems: z.array(SelfAuditHeldItem).parse(request.heldItems),
        submittedData:
            request.submittedData === null
                ? null
                : SelfAuditResponseData.parse(request.submittedData),
        formData: SelfAuditResponseData.parse(request.formInstance.formData),
        formStatus: request.formInstance.formStatus,
    };
}

// Create and send

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
    bundleName: string;
    requestedBy: string;
    timeZone: string;
    replyTo: string | undefined;
};

/** A request, as the send step reads it. */
type SendableRequest = {
    id: SelfAuditRequestId;
    email: string;
    memberName: string;
    d4hTeamTitle: string;
};

/** The organization's name, time zone and Reply-To, and the caller's name as the sender. */
async function loadSendContext(
    ctx: OrgServiceContext,
    bundleName: string,
): Promise<SelfAuditSendContext> {
    const [organization, sender, settings] = await Promise.all([
        ctx.prisma.organization.findUniqueOrThrow({
            where: { id: ctx.organizationId },
            select: { name: true },
        }),
        ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
        OrgSettings.read(ctx.prisma, ctx.organizationId),
    ]);
    return {
        organizationName: organization.name,
        bundleName,
        requestedBy: sender?.name || UNKNOWN_SENDER,
        timeZone: settings.general.timeZone,
        replyTo: orgReplyTo(settings),
    };
}

/**
 * Send one request's link: a fresh token, valid for `SELF_AUDIT_TOKEN_DAYS`, replacing any earlier
 * one (decision 1). Shared by create and resend.
 *
 * The hash and expiry go on (`Pending`) just before the send, as in the nag runner, so the link
 * works even if the `Sent` write is lost: then it stays `Pending` and still counts as sent. On
 * success the request is `Sent` with a new `sentAt`; on failure it's `Failed` with no token. Either way the outcome is logged with its write. Progress
 * and answers are never touched (decision 13).
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
            team: { name: request.d4hTeamTitle },
            bundle: { name: send.bundleName },
            requestedBy: send.requestedBy,
            formUrl: `${baseUrl}/forms/kit-check/${link.token}`,
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

/** How a self audit campaign's sends went. */
export type SelfAuditSendResult = {
    campaignId: SelfAuditCampaignId;
    sent: number;
    failed: number;
    noEmail: number;
};

/**
 * Create a self audit campaign of the bundle for the chosen D4H members of the chosen teams, and email each
 * of them their link.
 *
 * Computes as the preview does, as the caller's D4H token sees it, and snapshots it (decision 6),
 * then keeps only the chosen members of each team; the rest get no request. A team listed twice
 * gets the members chosen under either listing. A team with nobody chosen is left out of the
 * check: it isn't in its `d4hTeams` or its `templates`.
 * One transaction creates the `SelfAuditCampaign` and, per chosen member, a Draft `FormInstance` holding the
 * pre-filled answer and a `SelfAuditRequest`: `Pending`, or `NoEmail` when D4H has no email for
 * them (decision 12). Then each `Pending` request is sent in turn, `SEND_SPACING_MS` apart; one
 * failure marks that request `Failed` and the rest carry on (decision 14). Every entry joins one
 * `self-audit-campaign-send` batch (decision 11).
 *
 * @throws NotFoundError if the bundle isn't in the organization, or the token doesn't reach a team.
 * @throws ValidationError if the bundle is Deleted, no member is chosen, more than
 * `SELF_AUDIT_RECIPIENTS_MAX` are, or a chosen member isn't in the team they're chosen under.
 */
export async function createCampaign(
    ctx: OrgServiceContext,
    {
        accessToken,
        bundleId,
        teams: choices,
    }: {
        accessToken: D4HAccessToken_ServerOnly;
        bundleId: I3BundleId;
        teams: SelfAuditTeamChoice[];
    },
    deps: SelfAuditSendDeps = defaultSelfAuditSendDeps,
): Promise<SelfAuditSendResult> {
    const chosen = new Map<number, Set<number>>();
    for (const { d4hTeamId, d4hMemberIds } of choices) {
        const memberIds = chosen.get(d4hTeamId) ?? new Set<number>();
        for (const memberId of d4hMemberIds) memberIds.add(memberId);
        chosen.set(d4hTeamId, memberIds);
    }
    if ([...chosen.values()].every((memberIds) => memberIds.size === 0)) {
        throw new ValidationError("Choose at least one member to send the self audit campaign to.");
    }
    const recipientCount = [...chosen.values()].reduce((total, ids) => total + ids.size, 0);
    if (recipientCount > SELF_AUDIT_RECIPIENTS_MAX) {
        throw new ValidationError(
            `A self audit campaign can go to at most ${SELF_AUDIT_RECIPIENTS_MAX} members; ${recipientCount} are chosen.`,
        );
    }

    const { bundle, teams: computed } = await computeTeamSnapshots(ctx, {
        accessToken,
        bundleId,
        // A team with nobody chosen is left out of the check altogether.
        d4hTeamIds: [...chosen].filter(([, memberIds]) => memberIds.size > 0).map(([id]) => id),
    });

    const teams = computed.map((snapshot) => {
        const memberIds = chosen.get(snapshot.team.id) ?? new Set<number>();
        const known = new Set(snapshot.members.map(({ member }) => member.id));
        if ([...memberIds].some((memberId) => !known.has(memberId))) {
            // Most likely someone left the team between the preview and the send.
            throw new ValidationError(
                "The team's members changed since the preview. Refresh and send again.",
            );
        }
        return {
            ...snapshot,
            members: snapshot.members.filter(({ member }) => memberIds.has(member.id)),
        };
    });

    const campaignId = SelfAuditCampaignId.create();
    const templates: SelfAuditTemplatesByTeam = Object.fromEntries(
        teams.map(({ team, templates }) => [String(team.id), templates]),
    );
    const requests = teams.flatMap(({ team, members }) =>
        members.map(({ member, heldItems, response }) => ({
            id: SelfAuditRequestId.create(),
            formInstanceId: FormInstanceId.create(),
            team,
            member,
            heldItems,
            response,
        })),
    );

    const batch = await createLogBatch(
        { operationKey: "self-audit-campaign-send", userId: ctx.userId },
        ctx.prisma,
    );
    const batchCtx = withBatch(ctx, batch.id);
    const teamTitles = teams.map(({ team }) => team.title).join(", ");

    await ctx.prisma.$transaction([
        ctx.prisma.selfAuditCampaign.create({
            data: {
                id: campaignId,
                organizationId: ctx.organizationId,
                bundleId: bundle.id,
                bundleName: bundle.name,
                d4hTeams: teams.map(({ team }) => team),
                templates,
                sentById: ctx.userId,
            },
        }),
        batchCtx.logEvent({
            action: "Create",
            objectType: "SelfAuditCampaign",
            objectId: campaignId,
            description: `Self Audit Campaign of ${bundle.name} for ${teamTitles}`,
            refs: [{ objectType: "I3Bundle", objectId: bundle.id, role: "context" }],
        }),
        ...requests.flatMap(({ id, formInstanceId, team, member, heldItems, response }) => [
            ctx.prisma.formInstance.create({
                data: {
                    id: formInstanceId,
                    formKey: SelfAuditForm.formKey,
                    organizationId: ctx.organizationId,
                    userId: null,
                    formData: response,
                    formStatus: "Draft",
                },
            }),
            ctx.prisma.selfAuditRequest.create({
                data: {
                    id,
                    organizationId: ctx.organizationId,
                    campaignId,
                    d4hTeamId: team.id,
                    d4hTeamTitle: team.title,
                    d4hMemberId: member.id,
                    memberName: member.name,
                    email: member.email,
                    heldItems,
                    deliveryStatus: member.email === null ? "NoEmail" : "Pending",
                    formInstanceId,
                },
            }),
            batchCtx.logEvent({
                action: "Create",
                objectType: "SelfAuditRequest",
                objectId: id,
                description: `Self-audit for ${member.name} (${team.title})${member.email === null ? ": no email in D4H" : ""}`,
                refs: [{ objectType: "SelfAuditCampaign", objectId: campaignId, role: "context" }],
            }),
        ]),
    ]);

    const send = await loadSendContext(ctx, bundle.name);
    const result: SelfAuditSendResult = { campaignId, sent: 0, failed: 0, noEmail: 0 };
    let sendAttempted = false;
    for (const { id, team, member } of requests) {
        if (member.email === null) {
            result.noEmail++;
            continue;
        }
        // Spacing goes between sends, not before the first.
        if (sendAttempted) await deps.sleep(SEND_SPACING_MS);
        sendAttempted = true;
        const request = {
            id,
            email: member.email,
            memberName: member.name,
            d4hTeamTitle: team.title,
        };
        try {
            const outcome = await sendRequest(batchCtx, request, send, deps);
            if (outcome === "Sent") result.sent++;
            else result.failed++;
        } catch {
            // A database error mustn't stop the loop: the rest would stay `Pending`, and a second
            // Send would email everyone twice. Best effort: the database may still be failing.
            result.failed++;
            await markFailed(batchCtx, request).catch(() => {});
        }
    }
    return result;
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
            d4hTeamTitle: true,
            deliveryStatus: true,
            campaign: { select: { bundleName: true } },
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
    const send = await loadSendContext(ctx, request.campaign.bundleName);
    const deliveryStatus = await sendRequest(
        withBatch(ctx, batch.id),
        {
            id: requestId,
            email: request.email,
            memberName: request.memberName,
            d4hTeamTitle: request.d4hTeamTitle,
        },
        send,
        deps,
    );
    return { campaignId: SelfAuditCampaignId.schema.parse(request.campaignId), deliveryStatus };
}
