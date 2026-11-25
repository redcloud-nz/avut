/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The member's side of a kit check: everything the emailed link (`/forms/kit-check/<token>`)
 * reaches, with no account. See `docs/plans/2026-11-25-kit-check-send.md`, decisions 7–11.
 *
 * Every call hashes the link token and finds the request holding that hash with an expiry still
 * ahead. An unknown token, one replaced by a resend, and an expired one all get the same answer:
 * `not-found` from the read, `NotFoundError(LINK_NOT_VALID)` from the writes. The admin side
 * (create, send, track) is in `kit-checks.ts`.
 */

import "server-only";

import * as z from "zod";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { KitCheckSubject } from "@/lib/kit-check-types";
import { answerErrors, EMPTY_ANSWER } from "@/lib/kit-check-validate";
import {
    KitCheckHeldItem,
    KitCheckResponseData,
    KitCheckTemplatesByTeam,
    type KitCheckTemplate,
} from "@/lib/schemas/kit-check";
import { OrganizationId } from "@/lib/schemas/organization";
import { hashLinkToken } from "@/server/link-token";
import { createLogBatch } from "@/server/log-entry";
import { isPrismaRecordNotFound } from "@/server/prisma-errors";

import { unattendedOrgContext, type OrgServiceContext } from "./service-context";

type PublicContext = Pick<OrgServiceContext, "prisma">;

/** What every write says for a token that finds no live request. */
export const LINK_NOT_VALID = "This link has expired or isn't valid.";

/** Who's asking, when the sender's account is gone. */
const UNKNOWN_SENDER = "the team equipment officer";

/** The member's form, as the public page reads it. */
export type KitCheckByToken =
    | { state: "not-found" }
    | {
          state: "ok";
          subject: KitCheckSubject;
          /** The request's team's templates, as snapshotted at send (decision 6a). */
          templates: KitCheckTemplate[];
          heldItems: KitCheckHeldItem[];
          /** The working copy. */
          formData: KitCheckResponseData;
          /** `Draft` while being answered (or reopened), `Submitted` once sent in. */
          formStatus: "Draft" | "Submitted";
          /** The last submitted answer (decision 10); null until the first submit. */
          submittedData: KitCheckResponseData | null;
          submittedAt: Date | null;
          expiresAt: Date;
      };

const requestSelect = {
    id: true,
    organizationId: true,
    kitCheckId: true,
    d4hTeamId: true,
    d4hTeamTitle: true,
    memberName: true,
    heldItems: true,
    expiresAt: true,
    openedAt: true,
    submittedAt: true,
    submittedData: true,
    formInstanceId: true,
    formInstance: { select: { formData: true, formStatus: true } },
    kitCheck: {
        select: { bundleName: true, templates: true, sentBy: { select: { name: true } } },
    },
} as const;

/** The live request a link token names, or `null` (unknown, replaced or expired). */
async function findRequestByToken(ctx: PublicContext, token: string) {
    return await ctx.prisma.kitCheckRequest.findFirst({
        where: { tokenHash: hashLinkToken(token), expiresAt: { gt: new Date() } },
        select: requestSelect,
    });
}

type TokenRequest = NonNullable<Awaited<ReturnType<typeof findRequestByToken>>>;

/** @throws NotFoundError(LINK_NOT_VALID) if the token names no live request. */
async function requireRequestByToken(ctx: PublicContext, token: string): Promise<TokenRequest> {
    const request = await findRequestByToken(ctx, token);
    if (!request) throw new NotFoundError(LINK_NOT_VALID);
    return request;
}

/** The request's own team's templates. */
function templatesOf(request: TokenRequest): KitCheckTemplate[] {
    const byTeam = KitCheckTemplatesByTeam.parse(request.kitCheck.templates);
    return byTeam[String(request.d4hTeamId)] ?? [];
}

/**
 * Whether an answer covers everything the form asks, by the form's own rules
 * (`src/lib/kit-check-validate.ts`): each held item, and each template the member holds none of.
 */
export function isKitCheckComplete(
    response: KitCheckResponseData,
    templates: readonly KitCheckTemplate[],
    heldItems: readonly KitCheckHeldItem[],
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
export async function getKitCheckByToken(
    ctx: PublicContext,
    token: string,
): Promise<KitCheckByToken> {
    const request = await findRequestByToken(ctx, token);
    if (!request) return { state: "not-found" };

    return {
        state: "ok",
        subject: {
            memberName: request.memberName,
            teamName: request.d4hTeamTitle,
            bundleName: request.kitCheck.bundleName,
            requestedBy: request.kitCheck.sentBy?.name || UNKNOWN_SENDER,
        },
        templates: templatesOf(request),
        heldItems: z.array(KitCheckHeldItem).parse(request.heldItems),
        formData: KitCheckResponseData.parse(request.formInstance.formData),
        formStatus: request.formInstance.formStatus === "Submitted" ? "Submitted" : "Draft",
        submittedData:
            request.submittedData === null
                ? null
                : KitCheckResponseData.parse(request.submittedData),
        submittedAt: request.submittedAt,
        // The lookup only finds a request with an expiry ahead.
        expiresAt: request.expiresAt!,
    };
}

/** Stamp `openedAt`, unless it's already set. */
async function stampOpened(ctx: PublicContext, request: TokenRequest): Promise<void> {
    if (request.openedAt !== null) return;
    await ctx.prisma.kitCheckRequest.updateMany({
        where: { id: request.id, openedAt: null },
        data: { openedAt: new Date() },
    });
}

/**
 * Record that the member opened their form: `openedAt`, if unset. Idempotent. Called once by the
 * page on mount, not on GET, so a link scanner that only fetches the page leaves it unset.
 * @throws NotFoundError(LINK_NOT_VALID) if the token names no live request.
 */
export async function openKitCheckByToken(ctx: PublicContext, token: string): Promise<void> {
    const request = await requireRequestByToken(ctx, token);
    await stampOpened(ctx, request);
}

/**
 * Autosave the member's working copy. Writes only while the form is a Draft, so a save landing
 * after a submit is refused (decision 9). Also stamps `openedAt`, in case the page's open call was
 * lost. Not logged.
 * @throws NotFoundError(LINK_NOT_VALID) if the token names no live request.
 * @throws ConflictError if the form has been submitted.
 */
export async function saveKitCheckDraftByToken(
    ctx: PublicContext,
    token: string,
    formData: KitCheckResponseData,
): Promise<void> {
    const request = await requireRequestByToken(ctx, token);

    const { count } = await ctx.prisma.formInstance.updateMany({
        where: { id: request.formInstanceId, formStatus: "Draft" },
        data: { formData, updatedAt: new Date() },
    });
    if (count === 0) {
        throw new ConflictError("This kit check has already been sent in.");
    }
    await stampOpened(ctx, request);
}

/**
 * Submit the member's answers: the working copy becomes the submitted answer (`submittedData`,
 * restamping `submittedAt`), and the form leaves Draft. One transaction, logged against the
 * request. The instance's write is guarded on Draft, so a second submit (another tab) throws and
 * rolls back, log entry included (decision 9).
 * @throws NotFoundError(LINK_NOT_VALID) if the token names no live request.
 * @throws ValidationError if the answers leave something the form asks unanswered.
 * @throws ConflictError if the form has already been submitted.
 */
export async function submitKitCheckByToken(
    ctx: PublicContext,
    token: string,
    formData: KitCheckResponseData,
): Promise<void> {
    const request = await requireRequestByToken(ctx, token);

    const heldItems = z.array(KitCheckHeldItem).parse(request.heldItems);
    if (!isKitCheckComplete(formData, templatesOf(request), heldItems)) {
        throw new ValidationError("Some questions haven't been answered yet.");
    }
    if (request.formInstance.formStatus !== "Draft") {
        throw new ConflictError("This kit check has already been sent in.");
    }

    const logCtx = await memberLogContext(ctx, request);
    const now = new Date();
    await ctx.prisma
        .$transaction([
            ctx.prisma.formInstance.update({
                where: { id: request.formInstanceId, formStatus: "Draft" },
                data: { formData, formStatus: "Submitted" },
            }),
            ctx.prisma.kitCheckRequest.update({
                where: { id: request.id },
                data: {
                    submittedData: formData,
                    submittedAt: now,
                    openedAt: request.openedAt ?? now,
                },
            }),
            logCtx.logEvent({
                action: "Update",
                objectType: "KitCheckRequest",
                objectId: request.id,
                description: `Kit check submitted by ${request.memberName} (${request.d4hTeamTitle})`,
                refs: [{ objectType: "KitCheck", objectId: request.kitCheckId, role: "context" }],
            }),
        ])
        .catch((error: unknown) => {
            // Another submit won the race between the check above and this write.
            if (isPrismaRecordNotFound(error)) {
                throw new ConflictError("This kit check has already been sent in.");
            }
            throw error;
        });
}

/**
 * Let the member change their submitted answers: the form goes back to Draft (decision 10).
 * `submittedData` and `submittedAt` stay, so the last submitted answers stand until they submit
 * again. A no-op if the form is already a Draft. Logged against the request.
 * @throws NotFoundError(LINK_NOT_VALID) if the token names no live request.
 */
export async function reopenKitCheckByToken(ctx: PublicContext, token: string): Promise<void> {
    const request = await requireRequestByToken(ctx, token);
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
                objectType: "KitCheckRequest",
                objectId: request.id,
                description: `Kit check reopened by ${request.memberName} (${request.d4hTeamTitle})`,
                refs: [{ objectType: "KitCheck", objectId: request.kitCheckId, role: "context" }],
            }),
        ])
        .catch((error: unknown) => {
            // Another tab reopened it first: what was asked for already holds.
            if (isPrismaRecordNotFound(error)) return;
            throw error;
        });
}
