/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/forms/chch-soft-shell-jacket/answers
 */

import { TRPCError } from "@trpc/server";

import { getOrganizationBySlug } from "@/server/cache/organization";
import * as PublicForms from "@/server/services/public-forms";
import { fetchQuery, trpc } from "@/trpc/server";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * The soft shell jacket form's answers as a CSV download, for the organisation's admins. Unlinked
 * for now. The procedure checks the caller's permissions, so this route doesn't.
 */
export async function GET(_request: Request, { params }: Ctx) {
    const { slug } = await params;
    const organization = await getOrganizationBySlug(slug);

    try {
        const rows = await fetchQuery(
            trpc.publicForms.listJacketInterest.queryOptions({ organizationId: organization.id }),
        );
        const date = new Date().toISOString().slice(0, 10);
        return new Response(PublicForms.jacketInterestCsv(rows), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="chch-soft-shell-jacket-${date}.csv"`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        // `fetchQuery` already turns FORBIDDEN (not an admin) into Next's 403 and NOT_FOUND into
        // its 404; an expired session reaches here as UNAUTHORIZED.
        if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
            return new Response("Sign in first.", { status: 401 });
        }
        throw error;
    }
}
