/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The member's side of a self-audit: everything the emailed link
 * (`/forms/<org slug>/d4h-i3-self-audit/<token>`) reaches, with no account. See
 * `docs/plans/2026-11-25-kit-check-send.md`, decisions 7–11, and
 * `docs/plans/2026-11-27-self-audit-campaigns.md`, decision 2.
 *
 * Every call hashes the link token and finds the request holding that hash with an expiry still
 * ahead, in the organisation the URL's slug names. An unknown token, one replaced by a resend, an
 * expired one, and one under another organisation's slug all get the same answer: `not-found`
 * from the read, `NotFoundError(LINK_NOT_VALID)` from the writes. The admin side
 * (create, send, track) is in `self-audit-campaigns.ts`.
 */

import "server-only";

import * as z from "zod";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    SelfAuditHeldItem,
    SelfAuditResponseData,
    SelfAuditTemplatesByTeam,
    type SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { NOT_NEEDED, OTHER_VARIANT, type SelfAuditSubject } from "@/lib/self-audit-types";
import { answerErrors, ANY_VARIANT, EMPTY_ANSWER } from "@/lib/self-audit-validate";
import { hashLinkToken } from "@/server/link-token";
import { createLogBatch } from "@/server/log-entry";
import { isPrismaRecordNotFound } from "@/server/prisma-errors";

import { unattendedOrgContext, type OrgServiceContext } from "./service-context";

type PublicContext = Pick<OrgServiceContext, "prisma">;

/** What a self-audit link carries: the organisation's slug and the link token. */
export interface SelfAuditLink {
    slug: string;
    token: string;
}

/** What every write says for a token that finds no live request. */
export const LINK_NOT_VALID = "This link has expired or isn't valid.";

/** Who's asking, when the sender's account is gone. */
const UNKNOWN_SENDER = "the team equipment officer";

/** The member's form, as the public page reads it. */
export type SelfAuditByToken =
    | { state: "not-found" }
    | {
          state: "ok";
          subject: SelfAuditSubject;
          /** The request's team's templates, as snapshotted at send (decision 6a). */
          templates: SelfAuditTemplate[];
          heldItems: SelfAuditHeldItem[];
          /** The working copy. */
          formData: SelfAuditResponseData;
          /** `Draft` while being answered (or reopened), `Submitted` once sent in. */
          formStatus: "Draft" | "Submitted";
          /** The last submitted answer (decision 10); null until the first submit. */
          submittedData: SelfAuditResponseData | null;
          submittedAt: Date | null;
          expiresAt: Date;
      };

const requestSelect = {
    id: true,
    organizationId: true,
    campaignId: true,
    d4hTeamId: true,
    d4hTeamTitle: true,
    memberName: true,
    heldItems: true,
    expiresAt: true,
    openedAt: true,
    submittedAt: true,
    submittedData: true,
    formInstanceId: true,
    organization: { select: { slug: true } },
    formInstance: { select: { formData: true, formStatus: true } },
    campaign: {
        select: { bundleName: true, templates: true, sentBy: { select: { name: true } } },
    },
} as const;

/**
 * The live request a link names, or `null` (unknown, replaced or expired token, or a slug that
 * isn't the token's organisation's).
 */
async function findRequestByToken(ctx: PublicContext, { slug, token }: SelfAuditLink) {
    const request = await ctx.prisma.selfAuditRequest.findFirst({
        where: { tokenHash: hashLinkToken(token), expiresAt: { gt: new Date() } },
        select: requestSelect,
    });
    return request && request.organization.slug === slug ? request : null;
}

type TokenRequest = NonNullable<Awaited<ReturnType<typeof findRequestByToken>>>;

/** @throws NotFoundError(LINK_NOT_VALID) if the link names no live request. */
async function requireRequestByToken(
    ctx: PublicContext,
    link: SelfAuditLink,
): Promise<TokenRequest> {
    const request = await findRequestByToken(ctx, link);
    if (!request) throw new NotFoundError(LINK_NOT_VALID);
    return request;
}

/** The request's own team's templates. */
function templatesOf(request: TokenRequest): SelfAuditTemplate[] {
    const byTeam = SelfAuditTemplatesByTeam.parse(request.campaign.templates);
    return byTeam[String(request.d4hTeamId)] ?? [];
}

/**
 * Whether an answer covers everything the form asks, by the form's own rules
 * (`src/lib/self-audit-validate.ts`): each held item, and each template the member holds none of.
 */
export function isSelfAuditComplete(
    response: SelfAuditResponseData,
    templates: readonly SelfAuditTemplate[],
    heldItems: readonly SelfAuditHeldItem[],
): boolean {
    const templateById = new Map(templates.map((template) => [template.id, template]));
    const heldTemplateIds = new Set(heldItems.map((item) => item.templateId));
    const answered = (errors: object) => Object.keys(errors).length === 0;

    const heldDone = heldItems.every((item) => {
        const template = templateById.get(item.templateId);
        return (
            !template ||
            answered(answerErrors(response.held[item.id] ?? EMPTY_ANSWER, template, item))
        );
    });
    const missingDone = templates
        .filter((template) => !heldTemplateIds.has(template.id))
        .every((template) =>
            answered(answerErrors(response.missing[template.id] ?? EMPTY_ANSWER, template, null)),
        );
    return heldDone && missingDone;
}

/**
 * An answer cut down to what the member was asked: held answers for their own held items, missing
 * answers for the templates they hold none of, and extra rows that name an item. Every answer kept
 * is kept as given, "Not sure" included.
 */
export function pruneSelfAuditResponse(
    response: SelfAuditResponseData,
    templates: readonly SelfAuditTemplate[],
    heldItems: readonly SelfAuditHeldItem[],
): SelfAuditResponseData {
    const heldIds = new Set(heldItems.map((item) => item.id));
    const heldTemplateIds = new Set(heldItems.map((item) => item.templateId));
    const missingIds = new Set(
        templates
            .map((template) => template.id)
            .filter((templateId) => !heldTemplateIds.has(templateId)),
    );
    return {
        held: Object.fromEntries(Object.entries(response.held).filter(([id]) => heldIds.has(id))),
        missing: Object.fromEntries(
            Object.entries(response.missing).filter(([id]) => missingIds.has(id)),
        ),
        extras: response.extras.filter((extra) => extra.item.trim() !== ""),
        comments: response.comments,
    };
}

/** The variant ids an answer may hold besides the template's own: none, and the form's choices. */
const VARIANT_SENTINELS: ReadonlySet<string> = new Set([
    "",
    OTHER_VARIANT,
    ANY_VARIANT,
    NOT_NEEDED,
]);

/**
 * Refuse an answer whose `variantId` or `wantVariantId` is neither one of its template's offered
 * variants nor one of the form's own choices (none, Other, Any, Not needed). Answers for items the
 * member wasn't asked about are skipped: prune first.
 * @throws ValidationError naming the first unknown variant id.
 */
export function assertKnownSelfAuditVariants(
    response: SelfAuditResponseData,
    templates: readonly SelfAuditTemplate[],
    heldItems: readonly SelfAuditHeldItem[],
): void {
    const templateById = new Map(templates.map((template) => [template.id, template]));
    const heldById = new Map(heldItems.map((item) => [item.id, item]));
    const answers = [
        ...Object.entries(response.held).map(
            ([id, answer]) => [heldById.get(id)?.templateId, answer] as const,
        ),
        ...Object.entries(response.missing),
    ];
    for (const [templateId, answer] of answers) {
        const template = templateId === undefined ? undefined : templateById.get(templateId);
        if (!template) continue;
        const offered = new Set(template.variants.map((variant) => variant.id));
        for (const variantId of [answer.variantId, answer.wantVariantId]) {
            if (!VARIANT_SENTINELS.has(variantId) && !offered.has(variantId)) {
                throw new ValidationError(
                    `"${variantId}" isn't one of the choices for ${template.name}.`,
                );
            }
        }
    }
}

/** The actor-less log context for the member's submit and reopen (decision 11). */
async function memberLogContext(ctx: PublicContext, request: TokenRequest) {
    const actorLabel = `${request.memberName} (${request.d4hTeamTitle})`;
    const batch = await createLogBatch(
        { operationKey: "public-form-submission", actorLabel },
        ctx.prisma,
    );
    return unattendedOrgContext(ctx.prisma, OrganizationId.schema.parse(request.organizationId), {
        id: batch.id,
        actorLabel,
    });
}

/**
 * The member's form for a link token: who it's for and who asked, what they're asked (the
 * snapshot), and their answers so far. Nothing else about the organization or other members.
 * Reads only: opening the link changes nothing (decision 7).
 */
export async function getSelfAuditByToken(
    ctx: PublicContext,
    link: SelfAuditLink,
): Promise<SelfAuditByToken> {
    const request = await findRequestByToken(ctx, link);
    if (!request) return { state: "not-found" };

    return {
        state: "ok",
        subject: {
            memberName: request.memberName,
            teamName: request.d4hTeamTitle,
            bundleName: request.campaign.bundleName,
            requestedBy: request.campaign.sentBy?.name || UNKNOWN_SENDER,
        },
        templates: templatesOf(request),
        heldItems: z.array(SelfAuditHeldItem).parse(request.heldItems),
        formData: SelfAuditResponseData.parse(request.formInstance.formData),
        formStatus: request.formInstance.formStatus === "Submitted" ? "Submitted" : "Draft",
        submittedData:
            request.submittedData === null
                ? null
                : SelfAuditResponseData.parse(request.submittedData),
        submittedAt: request.submittedAt,
        // The lookup only finds a request with an expiry ahead.
        expiresAt: request.expiresAt!,
    };
}

/** Stamp `openedAt`, unless it's already set. */
async function stampOpened(ctx: PublicContext, request: TokenRequest): Promise<void> {
    if (request.openedAt !== null) return;
    await ctx.prisma.selfAuditRequest.updateMany({
        where: { id: request.id, openedAt: null },
        data: { openedAt: new Date() },
    });
}

/**
 * Record that the member opened their form: `openedAt`, if unset. Idempotent. Called once by the
 * page on mount, not on GET, so a link scanner that only fetches the page leaves it unset.
 * @throws NotFoundError(LINK_NOT_VALID) if the link names no live request.
 */
export async function openSelfAuditByToken(ctx: PublicContext, link: SelfAuditLink): Promise<void> {
    const request = await requireRequestByToken(ctx, link);
    await stampOpened(ctx, request);
}

/**
 * Autosave the member's working copy. Writes only while the form is a Draft, so a save landing
 * after a submit is refused (decision 9). Also stamps `openedAt`, in case the page's open call was
 * lost. Not logged.
 * @throws NotFoundError(LINK_NOT_VALID) if the link names no live request.
 * @throws ConflictError if the form has been submitted.
 */
export async function saveSelfAuditDraftByToken(
    ctx: PublicContext,
    link: SelfAuditLink,
    formData: SelfAuditResponseData,
): Promise<void> {
    const request = await requireRequestByToken(ctx, link);

    const { count } = await ctx.prisma.formInstance.updateMany({
        where: { id: request.formInstanceId, formStatus: "Draft" },
        data: { formData, updatedAt: new Date() },
    });
    if (count === 0) {
        throw new ConflictError("This self-audit has already been sent in.");
    }
    await stampOpened(ctx, request);
}

/**
 * Submit the member's answers: the working copy becomes the submitted answer (`submittedData`,
 * restamping `submittedAt`), and the form leaves Draft. One transaction, logged against the
 * request. The instance's write is guarded on Draft, so a second submit (another tab) throws and
 * rolls back, log entry included (decision 9). What's stored is pruned to what the member was
 * asked (`pruneSelfAuditResponse`).
 * @throws NotFoundError(LINK_NOT_VALID) if the link names no live request.
 * @throws ConflictError if the form has already been submitted.
 * @throws ValidationError if the answers leave something the form asks unanswered, or pick a
 * variant the template doesn't offer.
 */
export async function submitSelfAuditByToken(
    ctx: PublicContext,
    link: SelfAuditLink,
    submitted: SelfAuditResponseData,
): Promise<void> {
    const request = await requireRequestByToken(ctx, link);

    // Before completeness: a repeat submit is a conflict, whatever it carries.
    if (request.formInstance.formStatus !== "Draft") {
        throw new ConflictError("This self-audit has already been sent in.");
    }
    const templates = templatesOf(request);
    const heldItems = z.array(SelfAuditHeldItem).parse(request.heldItems);
    const formData = pruneSelfAuditResponse(submitted, templates, heldItems);
    assertKnownSelfAuditVariants(formData, templates, heldItems);
    if (!isSelfAuditComplete(formData, templates, heldItems)) {
        throw new ValidationError("Some questions haven't been answered yet.");
    }

    const logCtx = await memberLogContext(ctx, request);
    const now = new Date();
    await ctx.prisma
        .$transaction([
            ctx.prisma.formInstance.update({
                where: { id: request.formInstanceId, formStatus: "Draft" },
                data: { formData, formStatus: "Submitted" },
            }),
            ctx.prisma.selfAuditRequest.update({
                where: { id: request.id },
                data: {
                    submittedData: formData,
                    submittedAt: now,
                    openedAt: request.openedAt ?? now,
                },
            }),
            logCtx.logEvent({
                action: "Update",
                objectType: "SelfAuditRequest",
                objectId: request.id,
                description: `Self-audit submitted by ${request.memberName} (${request.d4hTeamTitle})`,
                refs: [
                    {
                        objectType: "SelfAuditCampaign",
                        objectId: request.campaignId,
                        role: "context",
                    },
                ],
            }),
        ])
        .catch((error: unknown) => {
            // Another submit won the race between the check above and this write.
            if (isPrismaRecordNotFound(error)) {
                throw new ConflictError("This self-audit has already been sent in.");
            }
            throw error;
        });
}

/**
 * Let the member change their submitted answers: the form goes back to Draft (decision 10).
 * `submittedData` and `submittedAt` stay, so the last submitted answers stand until they submit
 * again. A no-op if the form is already a Draft. Logged against the request.
 * @throws NotFoundError(LINK_NOT_VALID) if the link names no live request.
 */
export async function reopenSelfAuditByToken(
    ctx: PublicContext,
    link: SelfAuditLink,
): Promise<void> {
    const request = await requireRequestByToken(ctx, link);
    if (request.formInstance.formStatus !== "Submitted") return;

    const logCtx = await memberLogContext(ctx, request);
    await ctx.prisma
        .$transaction([
            ctx.prisma.formInstance.update({
                where: { id: request.formInstanceId, formStatus: "Submitted" },
                data: { formStatus: "Draft" },
            }),
            logCtx.logEvent({
                action: "Update",
                objectType: "SelfAuditRequest",
                objectId: request.id,
                description: `Self-audit reopened by ${request.memberName} (${request.d4hTeamTitle})`,
                refs: [
                    {
                        objectType: "SelfAuditCampaign",
                        objectId: request.campaignId,
                        role: "context",
                    },
                ],
            }),
        ])
        .catch((error: unknown) => {
            // Another tab reopened it first: what was asked for already holds.
            if (isPrismaRecordNotFound(error)) return;
            throw error;
        });
}
