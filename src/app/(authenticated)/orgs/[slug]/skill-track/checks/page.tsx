/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/checks
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import SkillTrack_ChecksList from "./checks-list";

export const metadata = {
    title: "Skill Checks",
};

export default async function SkillTrack_Checks_Page(
    props: PageProps<"/orgs/[slug]/skill-track/checks">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/orgs/[slug]/skill-track", { slug }) },
                    { label: "Checks", href: route("/orgs/[slug]/skill-track/checks", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_ChecksList />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
