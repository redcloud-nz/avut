/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List, ListItem } from "@/components/ui/list";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { getD4hTeams, getD4hWhoami } from "@/lib/d4h-api/client";
import { D4hAccessTokenData } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import prisma from "@/server/prisma";

export default async function Admin_D4hAccessToken_Access_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]/access`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const record = await prisma.d4hAccessToken.findUnique({
        where: {
            id: token_id,
            organizationId: organization.id,
        },
    });

    if (!record) {
        throw new Error("Token not found");
    }

    const token = D4hAccessTokenData.fromRecord(record);

    const whoami = await getD4hWhoami(token);

    const teams = await getD4hTeams(token);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.org(slug).admin.d4hAccessToken(token_id)
                            .href,
                        label: record.id,
                    },
                    "Access",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.d4hAccessToken(
                                    token_id,
                                )}
                            >
                                Access Token
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>Teams</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeadCell className="text-center">
                                                ID
                                            </TableHeadCell>
                                            <TableHeadCell>Name</TableHeadCell>
                                            <TableHeadCell className="text-center">
                                                Owner
                                            </TableHeadCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teams.map((team) => (
                                            <TableRow key={team.id}>
                                                <TableCell className="text-center">
                                                    {team.id}
                                                </TableCell>
                                                <TableCell>
                                                    {team.title}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {team.owner
                                                        ? `${team.owner.resourceType}: ${team.owner.id}`
                                                        : null}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Whoami</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre>{JSON.stringify(whoami, null, 2)}</pre>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
