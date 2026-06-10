/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skills/catalogue
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";

import { route } from "@/lib/routes";

import { SkillsModule_CataloguePackages_List } from "./catalogue-packages-list";

export const metadata = {
    title: `Catalogue ${TITLE_SEPARATOR} Skills`,
};

export default async function SkillsModule_Catalogue_Page(
    props: PageProps<"/main/[slug]/skills/catalogue">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Catalogue", href: route("/main/[slug]/skills/catalogue", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <SkillsModule_CataloguePackages_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
