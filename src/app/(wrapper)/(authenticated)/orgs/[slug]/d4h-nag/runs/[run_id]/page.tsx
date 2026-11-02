/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-nag/runs/[run_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HNagRunId } from "@/lib/schemas/d4h-nag";
import { D4HNag_Run_Content } from "@/modules/d4h-nag/components/run-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-nag/runs/[run_id]">;

const MODULE_TITLE = "D4H Attendance Reminders";

// As on the rules page, nothing is fetched for an org that can't use the module; the layout's
// `D4HNag_ModuleGate` renders the "not enabled" error instead.

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, run_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-nag"))) return { title: MODULE_TITLE };

    const organization = await getOrganizationBySlug(slug);
    const runId = D4HNagRunId.schema.parse(run_id);
    const run = await fetchQuery(
        trpc.d4hNag.getRun.queryOptions({ organizationId: organization.id, runId }),
    );

    return {
        title: `${run.dryRun ? "Dry Run" : "Run"}: ${run.teamName} ${TITLE_SEPARATOR} ${MODULE_TITLE}`,
    };
}

export default async function D4HNag_Run_Page(props: Props) {
    const { slug, run_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const runId = D4HNagRunId.schema.parse(run_id);

    if (await isOrganizationModuleUsable(slug, "d4h-nag")) {
        prefetch(trpc.d4hNag.getRun.queryOptions({ organizationId: organization.id, runId }));
    }

    return (
        <HydrateClient>
            <D4HNag_Run_Content runId={runId} />
        </HydrateClient>
    );
}
