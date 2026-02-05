/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { getD4hFetchClient, getD4hTeams } from "@/lib/d4h-api/client";
import { D4hAccessTokenData } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import prisma from "@/server/prisma";
import { D4hMember } from "@/lib/d4h-api/member";
import { Alert } from "@/components/ui/alert";

async function getTeamsWithMembers(token: D4hAccessTokenData) {
    //'use cache';
    //cacheTag(`d4h-api-${token.id}-team-${teamId}-members`);

    const fetchClient = getD4hFetchClient(token);

    const teams = await getD4hTeams(token);

    const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
            const { data } = await fetchClient.GET(
                "/v3/{context}/{contextId}/members",
                {
                    params: {
                        path: {
                            context: "team",
                            contextId: team.id,
                        },
                        query: {
                            status: ["OPERATIONAL", "NON_OPERATIONAL"],
                        },
                    },
                },
            );
            return {
                ...team,
                members: (data as { results: D4hMember[] }).results,
            };
        }),
    );

    return teamsWithMembers;
}

export default async function Admin_D4hAccessToken_Teams_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]/teams`>,
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

    const teams = await getTeamsWithMembers(token);

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
                    "Teams",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
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
                        {teams.map((team) => (
                            <Card key={team.id}>
                                <CardHeader>
                                    <CardTitle>{team.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeadCell className="text-center">
                                                    ID
                                                </TableHeadCell>
                                                <TableHeadCell>
                                                    Name
                                                </TableHeadCell>
                                                <TableHeadCell className="text-center">
                                                    Operational
                                                </TableHeadCell>
                                                <TableHeadCell>
                                                    Role
                                                </TableHeadCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {team.members.map((member) => (
                                                <TableRow key={member.id}>
                                                    <TableCell className="text-center">
                                                        {member.id}
                                                    </TableCell>
                                                    <TableCell>
                                                        {member.name}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {member.status ===
                                                        "OPERATIONAL"
                                                            ? "Yes"
                                                            : ""}
                                                    </TableCell>
                                                    <TableCell>
                                                        {member.role.name}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ))}
                        {teams.length === 0 && (
                            <Alert title="No teams found." />
                        )}

                        {/* <Card>
                            <CardHeader>
                                <CardTitle>Whoami</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre>{JSON.stringify(whoami, null, 2)}</pre>
                            </CardContent>
                        </Card> */}
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
