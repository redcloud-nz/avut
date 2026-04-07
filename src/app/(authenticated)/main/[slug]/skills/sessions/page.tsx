/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions
 */

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import SkillsModule_Sessions_List from "./sessions-list";

export const metadata = {
    title: "Skill Check Sessions",
};

export default async function SkillsModule_Sessions_Page(
    props: PageProps<"/main/[slug]/skills/sessions">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.main(slug).skills.index, Paths.main(slug).skills.sessions]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <SkillsModule_Sessions_List />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
