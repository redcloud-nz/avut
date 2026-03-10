/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/teams
 */

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";

import { AdminModule_TeamsList } from "./teams-list";

export const metadata = {
    title: `Teams`,
};

export default async function AdminModule_TeamsList_Page(
    props: PageProps<"/main/[slug]/admin/teams">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.teams,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <AdminModule_TeamsList />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
