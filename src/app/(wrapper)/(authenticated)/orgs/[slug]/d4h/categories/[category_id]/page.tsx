/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/categories/[category_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Category_Content } from "@/modules/d4h/components/catalogue/category-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/categories/[category_id]">;

function parseCategoryId(category_id: string) {
    const categoryId = Number(category_id);
    if (!Number.isInteger(categoryId)) notFound();
    return categoryId;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, category_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const categoryId = parseCategoryId(category_id);

    try {
        const categories = await fetchQuery(
            trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
        );
        const category = categories.find((c) => c.id === categoryId);
        return { title: `${category?.title ?? "Category"} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Category ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

export default async function D4HModule_Category_Page(props: Props) {
    const { slug, category_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const categoryId = parseCategoryId(category_id);

    prefetch(trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <D4HModule_Category_Content categoryId={categoryId} />
        </HydrateClient>
    );
}
