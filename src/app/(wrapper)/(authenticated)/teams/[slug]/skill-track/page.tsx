/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";

// The team layout's title template adds the team's name.
export const metadata: Metadata = { title: "Skill Track" };

/** Placeholder module root: the index's links arrive with the team-scope pages they open. */
export default function Team_SkillTrack_Index_Page() {
    return (
        <Std.ScrollContainer>
            <Std.IndexPage title="Skill Track">{null}</Std.IndexPage>
        </Std.ScrollContainer>
    );
}
