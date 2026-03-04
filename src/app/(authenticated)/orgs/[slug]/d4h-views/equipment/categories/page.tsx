/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment-categories
 */

import { Lexington } from "@/components/blocks/lexington";

import { getD4HEquipmentCategories } from "@/lib/d4h-api/client";
import * as Paths from "@/paths";
import { getConfiguredD4HViewsAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";
import { D4HViewsModules_EquipmentCategories_List } from "./equipment-categories-list";

export default async function D4HViewsModule_EquipmentCategories_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/categories">,
) {
    const { slug } = await props.params;

    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getConfiguredD4HViewsAccessToken(organization.id);

    const equipmentCategories = await getD4HEquipmentCategories(accessToken);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).d4hViews.index,
                    Paths.org(slug).d4hViews.equipment,
                    Paths.org(slug).d4hViews.equipment.categories,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <D4HViewsModules_EquipmentCategories_List
                        categories={equipmentCategories}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
