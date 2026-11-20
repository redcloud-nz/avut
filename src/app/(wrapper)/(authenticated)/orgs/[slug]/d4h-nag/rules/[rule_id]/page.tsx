/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-nag/rules/[rule_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HNagRuleId } from "@/lib/schemas/d4h-nag";
import { D4HNag_Rule_Content } from "@/modules/d4h-nag/components/rule-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-nag/rules/[rule_id]">;

const MODULE_TITLE = "D4H Attendance Reminders";

// As on the rules page, nothing is fetched for an org that can't use the module; the layout's
// `D4HNag_ModuleGate` renders the "not enabled" error instead.

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, rule_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-nag"))) return { title: MODULE_TITLE };

    const organization = await getOrganizationBySlug(slug);
    const ruleId = D4HNagRuleId.schema.parse(rule_id);
    const rule = await fetchQuery(
        trpc.d4hNag.getRule.queryOptions({ organizationId: organization.id, ruleId }),
    );

    return {
        title: `${rule.team.name}: ${rule.schedule} ${TITLE_SEPARATOR} ${MODULE_TITLE}`,
    };
}

export default async function D4HNag_Rule_Page(props: Props) {
    const { slug, rule_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const ruleId = D4HNagRuleId.schema.parse(rule_id);

    if (await isOrganizationModuleUsable(slug, "d4h-nag")) {
        prefetch(trpc.d4hNag.getRule.queryOptions({ organizationId: organization.id, ruleId }));
        prefetch(trpc.d4hNag.listRuns.queryOptions({ organizationId: organization.id, ruleId }));
    }

    return (
        <HydrateClient>
            <D4HNag_Rule_Content ruleId={ruleId} />
        </HydrateClient>
    );
}
