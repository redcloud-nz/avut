/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { NotFoundError } from "@/lib/errors";
import { I3Bundle, I3BundleId, I3BundleLine } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import * as I3Bundles from "@/server/services/i3-bundles";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const i3BundlesRouter = createTrpcRouter({
    /**
     * Add templates to a bundle. Templates already in it are skipped.
     *
     * @throws TRPCError(NOT_FOUND) if the bundle does not exist in the organization.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted, or a template is not in the
     * organization, is Deleted, or has no D4H type.
     */
    addTemplates: organizationProcedure({ i3Bundle: ["update"] })
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                templateIds: z.array(I3TemplateId.schema).min(1),
            }),
        )
        .output(z.object({ updated: I3Bundle.schema }))
        .mutation(async ({ ctx, input: { bundleId, templateIds } }) => {
            return { updated: await I3Bundles.addTemplates(ctx, bundleId, templateIds) };
        }),

    /**
     * Create a bundle with no templates.
     */
    createBundle: organizationProcedure({ i3Bundle: ["create"] })
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                create: I3Bundle.modifiableSchema,
            }),
        )
        .output(z.object({ created: I3Bundle.schema }))
        .mutation(async ({ ctx, input: { bundleId, create } }) => {
            return { created: await I3Bundles.create(ctx, bundleId, create) };
        }),

    /**
     * Soft-delete a bundle (reversible via `recoverBundle`). Idempotent: deleting an
     * already-deleted bundle returns it unchanged.
     *
     * @throws TRPCError(NOT_FOUND) if the bundle does not exist in the organization.
     */
    deleteBundle: organizationProcedure({ i3Bundle: ["delete"] })
        .input(z.object({ bundleId: I3BundleId.schema }))
        .output(z.object({ deleted: I3Bundle.schema }))
        .mutation(async ({ ctx, input: { bundleId } }) => {
            return { deleted: await I3Bundles.deleteRecord(ctx, bundleId) };
        }),

    /**
     * A bundle and every one of its lines, soft-deleted templates included.
     *
     * @throws TRPCError(NOT_FOUND) if the bundle does not exist in the organization.
     */
    getBundle: organizationProcedure({ i3Bundle: ["view"] })
        .input(z.object({ bundleId: I3BundleId.schema }))
        .output(z.object({ bundle: I3Bundle.schema, lines: z.array(I3BundleLine.schema) }))
        .query(async ({ ctx, input: { bundleId } }) => {
            const result = await I3Bundles.getWithLines(ctx, bundleId);

            if (!result) throw new NotFoundError(Messages.i3BundleNotFound(bundleId));

            return result;
        }),

    /**
     * The organization's non-Deleted bundles, by name, each with the number of its lines that
     * can be compared.
     */
    listBundles: organizationProcedure({ i3Bundle: ["view"] })
        .output(z.array(I3Bundle.schema.extend({ templateCount: z.number() })))
        .query(async ({ ctx }) => {
            return I3Bundles.list(ctx);
        }),

    /**
     * Recover a Deleted bundle back to Active. Idempotent: recovering an already-active bundle
     * returns it unchanged.
     *
     * @throws TRPCError(NOT_FOUND) if the bundle does not exist in the organization.
     */
    recoverBundle: organizationProcedure({ i3Bundle: ["delete"] })
        .input(z.object({ bundleId: I3BundleId.schema }))
        .output(z.object({ updated: I3Bundle.schema }))
        .mutation(async ({ ctx, input: { bundleId } }) => {
            return { updated: await I3Bundles.recover(ctx, bundleId) };
        }),

    /**
     * Remove one template from a bundle.
     *
     * @throws TRPCError(NOT_FOUND) if the bundle does not exist in the organization, or the
     * template is not in it.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted.
     */
    removeTemplate: organizationProcedure({ i3Bundle: ["update"] })
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                templateId: I3TemplateId.schema,
            }),
        )
        .output(z.object({ updated: I3Bundle.schema }))
        .mutation(async ({ ctx, input: { bundleId, templateId } }) => {
            return { updated: await I3Bundles.removeTemplate(ctx, bundleId, templateId) };
        }),

    /**
     * Update a bundle's name and description.
     *
     * @throws TRPCError(NOT_FOUND) if the bundle does not exist in the organization.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted.
     */
    updateBundle: organizationProcedure({ i3Bundle: ["update"] })
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                update: I3Bundle.modifiableSchema,
            }),
        )
        .output(z.object({ updated: I3Bundle.schema }))
        .mutation(async ({ ctx, input: { bundleId, update } }) => {
            return { updated: await I3Bundles.update(ctx, bundleId, update) };
        }),
});
