/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/teams
 */

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_D4hAccessTokensList } from "./d4h-access-tokens-list";

export const metadata = {
    title: `D4H Access Tokens`,
};

export default async function AdminModule_D4hAccessTokens_Page(
    props: PageProps<"/main/[slug]/admin/d4h-access-tokens">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.d4hAccessTokens,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <AdminModule_D4hAccessTokensList
                        organization={organization}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
