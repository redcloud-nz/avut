/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skills/catalogue
 */

import { Lexington } from "@/components/blocks/lexington";
import { TITLE_SEPARATOR } from "@/lib/constants";

import * as Paths from "@/paths";

import { SkillsModule_CataloguePackages_List } from "./catalogue-packages-list";

export const metadata = {
    title: `Catalogue ${TITLE_SEPARATOR} Skills`,
};

export default async function SkillsModule_Catalogue_Page(
    props: PageProps<"/orgs/[slug]/skills/catalogue">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skills.index,
                    Paths.org(slug).skills.catalogue,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <SkillsModule_CataloguePackages_List />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
