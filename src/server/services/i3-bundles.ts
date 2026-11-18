/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
    I3Bundle,
    I3BundleLine,
    type I3BundleId,
    type I3BundleSummary,
    type ModifiableI3Bundle,
} from "@/lib/schemas/i3-bundle";
import type { I3TemplateId } from "@/lib/schemas/i3-template";
import type { LogEntryRef } from "@/server/log-entry";

import type { OrgServiceContext } from "./service-context";

/** A bundle and every one of its lines. */
export type I3BundleWithLines = {
    bundle: I3Bundle;
    lines: I3BundleLine[];
};

const lineTemplateInclude = {
    template: { include: { d4h: true } },
} as const satisfies Prisma.I3BundleItemInclude;

type LineRecord = Prisma.I3BundleItemGetPayload<{ include: typeof lineTemplateInclude }>;

function hasPrismaCode(e: unknown, code: string): boolean {
    return e instanceof Object && "code" in e && e.code === code;
}

function templateRef(templateId: string): LogEntryRef {
    return { objectType: "I3Template", objectId: templateId, role: "context" };
}

function toLine(record: LineRecord): I3BundleLine {
    const { template } = record;
    return I3BundleLine.schema.parse({
        template: {
            id: template.id,
            name: template.name,
            status: template.status,
            d4h: template.d4h
                ? {
                      categoryId: template.d4h.categoryId,
                      categoryTitle: template.d4h.categoryTitle,
                      kindId: template.d4h.kindId,
                      kindTitle: template.d4h.kindTitle,
                  }
                : null,
        },
    });
}

/**
 * Lines by category title, then category id (so each category's lines sit together even when two
 * categories share a title), then template name; lines with no D4H type last, by name.
 */
function compareLines(a: I3BundleLine, b: I3BundleLine): number {
    const aD4H = a.template.d4h;
    const bD4H = b.template.d4h;
    if (aD4H === null && bD4H !== null) return 1;
    if (aD4H !== null && bD4H === null) return -1;
    if (aD4H !== null && bD4H !== null) {
        if (aD4H.categoryTitle !== bD4H.categoryTitle) {
            return aD4H.categoryTitle.localeCompare(bD4H.categoryTitle);
        }
        if (aD4H.categoryId !== bD4H.categoryId) return aD4H.categoryId - bD4H.categoryId;
    }
    return a.template.name.localeCompare(b.template.name);
}

/**
 * Fetch an I3 Bundle by ID, or `null` if it does not exist within the organization. Callers
 * that need the bundle to exist should use `requireById` instead.
 */
export async function getById(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
): Promise<I3Bundle | null> {
    const bundle = await ctx.prisma.i3Bundle.findUnique({
        where: { id: bundleId, organizationId: ctx.organizationId },
    });

    return bundle ? I3Bundle.fromRecord(bundle) : null;
}

/**
 * Fetch an I3 Bundle by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the bundle does not exist within the organization.
 */
export async function requireById(ctx: OrgServiceContext, bundleId: I3BundleId): Promise<I3Bundle> {
    const bundle = await getById(ctx, bundleId);

    if (!bundle) {
        throw new NotFoundError(`I3Bundle(id=${bundleId}) not found.`);
    }

    return bundle;
}

/** Fetch a bundle that can be written to. */
async function requireWritable(ctx: OrgServiceContext, bundleId: I3BundleId): Promise<I3Bundle> {
    const bundle = await requireById(ctx, bundleId);

    if (bundle.status === "Deleted") {
        throw new ValidationError(
            `I3Bundle(id=${bundleId}) is Deleted; recover it before changing it.`,
        );
    }

    return bundle;
}

/** The organization's non-Deleted bundles, by name, each with its comparable line count. */
export async function list(ctx: OrgServiceContext): Promise<I3BundleSummary[]> {
    const bundles = await ctx.prisma.i3Bundle.findMany({
        where: { organizationId: ctx.organizationId, status: { not: "Deleted" } },
        include: {
            _count: {
                select: {
                    items: { where: { template: { status: "Active", d4h: { isNot: null } } } },
                },
            },
        },
        orderBy: { name: "asc" },
    });

    return bundles.map(({ _count, ...bundle }) => ({
        ...I3Bundle.fromRecord(bundle),
        templateCount: _count.items,
    }));
}

/**
 * A bundle and every line, soft-deleted templates included, sorted by category title then
 * template name, with lines that have no D4H type last. `null` if the bundle does not exist
 * within the organization.
 */
export async function getWithLines(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
): Promise<I3BundleWithLines | null> {
    const record = await ctx.prisma.i3Bundle.findUnique({
        where: { id: bundleId, organizationId: ctx.organizationId },
        include: { items: { include: lineTemplateInclude } },
    });

    if (!record) return null;

    const { items, ...bundle } = record;

    return {
        bundle: I3Bundle.fromRecord(bundle),
        lines: items.map(toLine).toSorted(compareLines),
    };
}

/** Create a bundle with no lines. */
export async function create(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
    data: ModifiableI3Bundle,
): Promise<I3Bundle> {
    const [created] = await ctx.prisma.$transaction([
        ctx.prisma.i3Bundle.create({
            data: {
                id: bundleId,
                organizationId: ctx.organizationId,
                name: data.name,
                description: data.description,
            },
        }),
        ctx.logEvent({
            action: "Create",
            objectType: "I3Bundle",
            objectId: bundleId,
            changes: diffObject({}, data),
        }),
    ]);

    return I3Bundle.fromRecord(created);
}

/**
 * Update a bundle's name and description. No-op, returning the bundle unchanged, if nothing
 * differs.
 * @throws NotFoundError if the bundle does not exist within the organization.
 * @throws ValidationError if the bundle is Deleted.
 */
export async function update(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
    data: ModifiableI3Bundle,
): Promise<I3Bundle> {
    const existing = await requireWritable(ctx, bundleId);

    const changes = diffObject(I3Bundle.modifiableSchema.parse(existing), data);
    if (changes.length === 0) return existing;

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.i3Bundle.update({
            where: { id: bundleId, organizationId: ctx.organizationId },
            data: { name: data.name, description: data.description },
        }),
        ctx.logEvent({ action: "Update", objectType: "I3Bundle", objectId: bundleId, changes }),
    ]);

    return I3Bundle.fromRecord(updated);
}

/**
 * Add templates to a bundle. Templates already in it are skipped; if none is left, nothing is
 * written. Otherwise one `Update` entry names the added templates, with a context ref to each.
 * @throws NotFoundError if the bundle does not exist within the organization.
 * @throws ValidationError if the bundle is Deleted, or a template is not in the organization,
 * is not Active, or has no D4H type.
 * @throws ConflictError if another request added one of the templates since the lookup.
 */
export async function addTemplates(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
    templateIds: I3TemplateId[],
): Promise<I3Bundle> {
    const bundle = await requireWritable(ctx, bundleId);

    const requested = [...new Set(templateIds)];

    const [templates, existingLines] = await Promise.all([
        ctx.prisma.i3Template.findMany({
            where: { id: { in: requested }, organizationId: ctx.organizationId },
            include: { d4h: true },
        }),
        ctx.prisma.i3BundleItem.findMany({
            where: { bundleId, templateId: { in: requested } },
        }),
    ]);

    const alreadyIn = new Set(existingLines.map((line) => line.templateId));
    const byId = new Map(templates.map((template) => [template.id, template]));
    const added: typeof templates = [];
    for (const templateId of requested) {
        const template = byId.get(templateId);
        if (!template) {
            throw new ValidationError(`I3Template(id=${templateId}) not found.`);
        }
        if (template.status !== "Active") {
            throw new ValidationError(`I3Template(id=${templateId}) is ${template.status}.`);
        }
        if (!template.d4h) {
            throw new ValidationError(`I3Template(id=${templateId}) has no D4H type.`);
        }
        if (!alreadyIn.has(templateId)) added.push(template);
    }

    if (added.length === 0) return bundle;

    const [, updated] = await ctx.prisma
        .$transaction([
            ctx.prisma.i3BundleItem.createMany({
                data: added.map((template) => ({ bundleId, templateId: template.id })),
            }),
            ctx.prisma.i3Bundle.update({
                where: { id: bundleId, organizationId: ctx.organizationId },
                data: { updatedAt: new Date() },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "I3Bundle",
                objectId: bundleId,
                description: `Added ${added.length === 1 ? "template" : "templates"}: ${added.map((template) => template.name).join(", ")}`,
                refs: added.map((template) => templateRef(template.id)),
            }),
        ])
        .catch((e: unknown) => {
            // Another request added one of these templates since the lookup above.
            if (hasPrismaCode(e, "P2002")) {
                throw new ConflictError(
                    `A template was added to I3Bundle(id=${bundleId}) at the same time; try again.`,
                );
            }
            throw e;
        });

    return I3Bundle.fromRecord(updated);
}

/**
 * Remove one template from a bundle, logged as an `Update` naming it, with a context ref to it.
 * @throws NotFoundError if the bundle does not exist within the organization, or the template is
 * not in it (including when another request removed it since the lookup).
 * @throws ValidationError if the bundle is Deleted.
 */
export async function removeTemplate(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
    templateId: I3TemplateId,
): Promise<I3Bundle> {
    await requireWritable(ctx, bundleId);

    const line = await ctx.prisma.i3BundleItem.findUnique({
        where: { bundleId_templateId: { bundleId, templateId } },
        include: { template: true },
    });
    if (!line) {
        throw new NotFoundError(`I3Template(id=${templateId}) is not in I3Bundle(id=${bundleId}).`);
    }

    const [, updated] = await ctx.prisma
        .$transaction([
            ctx.prisma.i3BundleItem.delete({
                where: { bundleId_templateId: { bundleId, templateId } },
            }),
            ctx.prisma.i3Bundle.update({
                where: { id: bundleId, organizationId: ctx.organizationId },
                data: { updatedAt: new Date() },
            }),
            ctx.logEvent({
                action: "Update",
                objectType: "I3Bundle",
                objectId: bundleId,
                description: `Removed template: ${line.template.name}`,
                refs: [templateRef(templateId)],
            }),
        ])
        .catch((e: unknown) => {
            // Another request removed the line since the lookup above.
            if (hasPrismaCode(e, "P2025")) {
                throw new NotFoundError(
                    `I3Template(id=${templateId}) is not in I3Bundle(id=${bundleId}).`,
                );
            }
            throw e;
        });

    return I3Bundle.fromRecord(updated);
}

/**
 * Soft-delete a bundle (reversible via `recover`). No-op, returning the existing record
 * unchanged, if the bundle is already `Deleted`. Its lines are kept.
 * @throws NotFoundError if the bundle does not exist within the organization.
 */
export async function deleteRecord(
    ctx: OrgServiceContext,
    bundleId: I3BundleId,
): Promise<I3Bundle> {
    const existing = await requireById(ctx, bundleId);

    if (existing.status === "Deleted") {
        return existing;
    }

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.i3Bundle.update({
            where: { id: bundleId, organizationId: ctx.organizationId },
            data: { status: "Deleted" },
        }),
        ctx.logEvent({ action: "Delete", objectType: "I3Bundle", objectId: bundleId }),
    ]);

    return I3Bundle.fromRecord(updated);
}

/**
 * Recover a `Deleted` bundle back to `Active`. No-op, returning the existing record unchanged,
 * if the bundle is already `Active`.
 * @throws NotFoundError if the bundle does not exist within the organization.
 * @throws ValidationError if the bundle is neither `Active` nor `Deleted`.
 */
export async function recover(ctx: OrgServiceContext, bundleId: I3BundleId): Promise<I3Bundle> {
    const existing = await requireById(ctx, bundleId);

    if (existing.status === "Active") {
        return existing;
    }

    if (existing.status !== "Deleted") {
        throw new ValidationError(
            `I3Bundle(id=${bundleId}) has status ${existing.status}; only a Deleted bundle can be recovered from rubbish.`,
        );
    }

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.i3Bundle.update({
            where: { id: bundleId, organizationId: ctx.organizationId },
            data: { status: "Active" },
        }),
        ctx.logEvent({ action: "Recover", objectType: "I3Bundle", objectId: bundleId }),
    ]);

    return I3Bundle.fromRecord(updated);
}
