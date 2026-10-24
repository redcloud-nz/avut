/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/brands/[brand_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Brand_Content } from "@/modules/d4h/components/catalogue/brand-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/brands/[brand_id]">;

function parseBrandId(brand_id: string) {
    const brandId = Number(brand_id);
    if (!Number.isInteger(brandId)) notFound();
    return brandId;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, brand_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const brandId = parseBrandId(brand_id);

    try {
        const brands = await fetchQuery(
            trpc.d4hApi.listEquipmentBrands.queryOptions({ organizationId: organization.id }),
        );
        const brand = brands.find((b) => b.id === brandId);
        return { title: `${brand?.title ?? "Brand"} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Brand ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

export default async function D4HModule_Brand_Page(props: Props) {
    const { slug, brand_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const brandId = parseBrandId(brand_id);

    prefetch(trpc.d4hApi.listEquipmentBrands.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentModels.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <D4HModule_Brand_Content brandId={brandId} />
        </HydrateClient>
    );
}
