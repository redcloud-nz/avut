/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/d4h-access-tokens/[token_id]/whoami
 */

import { notFound } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { getD4HTeamsWithMembers, getD4HWhoami } from "@/lib/d4h-api/client";
import * as Paths from "@/paths";
import { getD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_Whoami_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]/whoami`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accesToken = await getD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accesToken) notFound();

    const whoami = await getD4HWhoami(accesToken);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.org(slug).admin.d4hAccessToken(token_id)
                            .href,
                        label: accesToken.id,
                    },
                    "Whoami",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.d4hAccessToken(
                                    token_id,
                                )}
                            />
                            <Hermes.Title>Whoami</Hermes.Title>
                        </Hermes.Header>
                        <pre className="text-xs">
                            {JSON.stringify(whoami, null, 2)}
                        </pre>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
