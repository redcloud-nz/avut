/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]
 */

import { Std } from "@/components/blocks/std";
import { requireTeam } from "@/server/team-access";

// Placeholder: the team dashboard replaces this.
export default async function Team_Index_Page(props: PageProps<"/teams/[slug]">) {
    const { slug } = await props.params;
    const { team } = await requireTeam(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={[team.name]} />
            <Std.ScrollContainer>
                <p className="p-4 text-muted-foreground">Team dashboard coming soon.</p>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
