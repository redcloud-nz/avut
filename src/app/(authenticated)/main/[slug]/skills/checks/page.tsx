/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/checks
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import SkillsModule_ChecksList from "./checks-list";

export const metadata = {
    title: "Skill Checks",
};

export default async function SkillsModule_Checks_Page(
    props: PageProps<"/main/[slug]/skills/checks">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Checks", href: route("/main/[slug]/skills/checks", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <SkillsModule_ChecksList />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
