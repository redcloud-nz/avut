/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/person
 */

import { Std } from "@/components/blocks/std";
import { SkillTrack_PersonPicker } from "@/components/skill-track/reports/person-picker";

import { route } from "@/lib/routes";

export const metadata = {
    title: `Personnel Competency`,
};

export default async function SkillTrack_ReportsPersonPicker_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/person">,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                    {
                        label: "Reports",
                        href: route("/orgs/[slug]/skill-track/reports", { slug }),
                    },
                    {
                        label: "Personnel Competency",
                        href: route("/orgs/[slug]/skill-track/reports/person", { slug }),
                    },
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_PersonPicker />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
