/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import SkillsModule_Sessions_List from "./sessions-list";

export const metadata = {
    title: "Skill Check Sessions",
};

export default async function SkillsModule_Sessions_Page(
    props: PageProps<"/main/[slug]/skills/sessions">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <SkillsModule_Sessions_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
