/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /skill-track/[slug]/sessions
 */

import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import SkillTrack_Sessions_List from "./sessions-list";

export const metadata = {
    title: `Skill Check Sessions ${TITLE_SEPARATOR} Skills Module`,
};

export default async function SkillTrack_Sessions_Page(
    props: PageProps<"/skill-track/[slug]/sessions">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/skill-track/[slug]", { slug }) },
                    { label: "Sessions", href: route("/skill-track/[slug]/sessions", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_Sessions_List />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
