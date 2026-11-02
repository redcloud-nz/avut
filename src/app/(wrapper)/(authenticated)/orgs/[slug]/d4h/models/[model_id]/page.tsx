/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/models/[model_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Model_Content } from "@/modules/d4h/components/catalogue/model-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/models/[model_id]">;

function parseModelId(model_id: string) {
    const modelId = Number(model_id);
    if (!Number.isInteger(modelId)) notFound();
    return modelId;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, model_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const modelId = parseModelId(model_id);

    try {
        const { model } = await fetchQuery(
            trpc.d4hApi.getEquipmentModel.queryOptions({
                organizationId: organization.id,
                modelId,
            }),
        );
        return { title: `${model.title} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Model ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

export default async function D4HModule_Model_Page(props: Props) {
    const { slug, model_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const modelId = parseModelId(model_id);

    prefetch(
        trpc.d4hApi.getEquipmentModel.queryOptions({ organizationId: organization.id, modelId }),
    );

    return (
        <HydrateClient>
            <D4HModule_Model_Content modelId={modelId} />
        </HydrateClient>
    );
}
