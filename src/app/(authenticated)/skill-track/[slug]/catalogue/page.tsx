/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /skill-track/[slug]/catalogue
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";

import { route } from "@/lib/routes";

import { SkillTrack_CataloguePackages_List } from "./catalogue-packages-list";

export const metadata = {
    title: `Catalogue ${TITLE_SEPARATOR} Skills`,
};

export default async function SkillTrack_Catalogue_Page(
    props: PageProps<"/skill-track/[slug]/catalogue">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/skill-track/[slug]", { slug }) },
                    { label: "Catalogue", href: route("/skill-track/[slug]/catalogue", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_CataloguePackages_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
