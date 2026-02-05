/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens/--create
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { AdminModule_CreateD4hAccessToken_Form } from "./create-d4h-access-token";

export const metadata = {
    title: `Create D4H Access Token`,
};

export default async function AdminModule_TeamCreate_Page(
    props: PageProps<`/orgs/[slug]/admin/teams/--create`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.d4hAccessTokens,
                    Paths.org(slug).admin.d4hAccessTokens.create,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.d4hAccessTokens}
                            >
                                D4H Access Tokens
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>New D4H Access Token</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminModule_CreateD4hAccessToken_Form
                                    organization={organization}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
