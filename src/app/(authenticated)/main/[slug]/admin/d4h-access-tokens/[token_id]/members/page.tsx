/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert2";

import { getD4HFetchClient, getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { D4HMember } from "@/lib/schemas/d4h/member";
import * as Paths from "@/paths";
import { getD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_Members_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/members`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accesToken = await getD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accesToken) notFound();

    const fetchClient = getD4HFetchClient(accesToken);

    const teams = await getD4HTeamsAccessibleWithToken(accesToken);

    const members = (
        await Promise.all(
            teams.map(async (team) => {
                const { data } = await fetchClient.GET("/v3/{context}/{contextId}/members", {
                    params: {
                        path: {
                            context: "team",
                            contextId: team.id,
                        },
                        query: {
                            status: ["OPERATIONAL", "NON_OPERATIONAL"],
                        },
                    },
                });

                return (data as { results: any[] }).results.map((member) => ({
                    raw: member,
                    parsed: D4HMember.schema.safeParse(member),
                }));
            }),
        )
    ).flat();

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.main(slug).admin.d4hAccessToken(token_id).href,
                        label: accesToken.id,
                    },
                    "Teams",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.main(slug).admin.d4hAccessToken(token_id)}
                            />
                            <Hermes.Title>Teams with Members</Hermes.Title>
                        </Hermes.Header>
                        {members.map((member) => (
                            <div className="grid grid-cols-2 border-b py-2">
                                <div className="col-span-full py-2 font-semibold text-center">
                                    {member.raw.id}
                                </div>
                                <div className="px-2 max-h-[50vh] overflow-y-auto">
                                    <pre className="text-xs">
                                        {JSON.stringify(member.raw, null, 2)}
                                    </pre>
                                </div>
                                <div className="px-2 max-h-[50vh] overflow-y-auto">
                                    {member.parsed.success ? (
                                        <pre className="text-xs">
                                            {JSON.stringify(member.parsed.data, null, 2)}
                                        </pre>
                                    ) : (
                                        <Alert>
                                            <AlertTitle>Failed to parse member data</AlertTitle>
                                            <AlertDescription>
                                                {member.parsed.error.message}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* {teams.map((team) => (
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
                        )} */}

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
