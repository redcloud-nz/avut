/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { diffObject } from "@/lib/diff";
import { NotConfiguredError } from "@/lib/errors";
import { J307_JACKET } from "@/lib/j307-jacket";
import { PUBLIC_FORMS, type PublicFormKey } from "@/lib/public-forms";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import {
    JacketInterestStored,
    type JacketInterestData,
    type JacketInterestRow,
    type JacketInterestSubmission,
} from "@/lib/schemas/jacket-interest";
import { OrganizationId } from "@/lib/schemas/organization";
import { serverEnv } from "@/server/env";
import { createLogBatch } from "@/server/log-entry";

import { unattendedOrgContext, type OrgServiceContext } from "./service-context";

/**
 * Public forms (`/forms/*`, see `src/lib/public-forms.ts`): answers from people without an
 * account, stored as Submitted `FormInstance`s with no user in the form's organisation, and read
 * back by that organisation's admins.
 */

type PublicContext = Pick<OrgServiceContext, "prisma">;

const JACKET_FORM_KEY = "chch-soft-shell-jacket" satisfies PublicFormKey;
const SUBMITTED = "Submitted";

/**
 * The organisation a public form stores its answers in.
 * @throws NotConfiguredError if no organisation has the form's slug.
 */
async function requireFormOrganization(ctx: PublicContext, key: PublicFormKey) {
    const slug = serverEnv.PUBLIC_FORMS_ORGANIZATION_SLUG ?? PUBLIC_FORMS[key].organizationSlug;
    const organization = await ctx.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
    });
    if (!organization) {
        throw new NotConfiguredError("This form isn't set up to take answers yet.");
    }
    return OrganizationId.schema.parse(organization.id);
}

/**
 * Store one answer to the soft shell jacket form. An answer with the honeypot filled in is a
 * bot's: it's dropped, but reported as stored, so the bot learns nothing. Each answer is its own
 * record; a person who sends again adds a newer one (the page says the latest counts).
 * @throws NotConfiguredError if the form's organisation doesn't exist.
 */
export async function submitJacketInterest(
    ctx: PublicContext,
    {
        answer,
        website,
    }: { answer: JacketInterestData; website: JacketInterestSubmission["website"] },
): Promise<void> {
    if (website.trim() !== "") return;

    const organizationId = await requireFormOrganization(ctx, JACKET_FORM_KEY);
    const actorLabel = `${answer.name} (${answer.team})`;
    const batch = await createLogBatch(
        { operationKey: "public-form-submission", actorLabel },
        ctx.prisma,
    );
    const logCtx = unattendedOrgContext(ctx.prisma, organizationId, { id: batch.id, actorLabel });

    const id = FormInstanceId.create();
    await ctx.prisma.$transaction([
        ctx.prisma.formInstance.create({
            data: {
                id,
                formKey: JACKET_FORM_KEY,
                organizationId,
                userId: null,
                formData: answer,
                formStatus: SUBMITTED,
            },
        }),
        logCtx.logEvent({
            action: "Create",
            objectType: "FormInstance",
            objectId: id,
            changes: diffObject({}, answer),
            description: `${PUBLIC_FORMS[JACKET_FORM_KEY].label}: ${actorLabel}`,
        }),
    ]);
}

/**
 * Every answer to the soft shell jacket form in the organisation, oldest first. A stored answer
 * that no longer parses is left out rather than failing the list.
 */
export async function listJacketInterest(ctx: OrgServiceContext): Promise<JacketInterestRow[]> {
    const records = await ctx.prisma.formInstance.findMany({
        where: {
            organizationId: ctx.organizationId,
            formKey: JACKET_FORM_KEY,
            formStatus: SUBMITTED,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return records.flatMap((record) => {
        const parsed = JacketInterestStored.safeParse(record.formData);
        return parsed.success
            ? [{ id: record.id, submittedAt: record.createdAt.toISOString(), answer: parsed.data }]
            : [];
    });
}

const INTEREST_LABELS = { yes: "Yes", no: "No", unsure: "Not sure" } as const;

/**
 * One CSV cell. Answers come from anyone with the link, so a value a spreadsheet would read as a
 * formula (`=`, `+`, `-`, `@`, or a tab or return first) gets a leading `'`, which keeps it as
 * text; then cells with quotes, commas or line breaks are quoted.
 */
export function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The answers as CSV, one row each, times in New Zealand time. */
export function jacketInterestCsv(rows: JacketInterestRow[]): string {
    const when = new Intl.DateTimeFormat("en-NZ", {
        timeZone: "Pacific/Auckland",
        dateStyle: "short",
        timeStyle: "short",
        hourCycle: "h23",
    });
    const header = ["Submitted", "Team", "Name", "Would use one", "Fit", "Size", "Comments"];
    const lines = rows.map(({ submittedAt, answer }) => [
        when.format(new Date(submittedAt)),
        answer.team,
        answer.name,
        INTEREST_LABELS[answer.interest],
        J307_JACKET.fits.find((fit) => fit.id === answer.fit)?.label ?? "",
        answer.size,
        answer.notes,
    ]);
    return [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
