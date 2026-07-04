/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-track/catalogue
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";

import { route } from "@/lib/routes";

import { SkillTrack_CataloguePackages_List } from "./catalogue-packages-list";

export const metadata = {
    title: `Catalogue ${TITLE_SEPARATOR} Skill Track`,
};

export default async function SkillTrack_Catalogue_Page(
    props: PageProps<"/orgs/[slug]/skill-track/catalogue">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                    {
                        label: "Catalogue",
                        href: route("/orgs/[slug]/skill-track/catalogue", { slug }),
                    },
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_CataloguePackages_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
