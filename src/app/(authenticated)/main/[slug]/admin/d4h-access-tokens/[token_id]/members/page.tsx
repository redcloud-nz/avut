/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { route } from "@/lib/routes";

import { D4HMember } from "@/lib/schemas/d4h/member";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getD4HFetchClient, getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { getOrganizationBySlug } from "@/server/organization";

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_Members_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/members`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetchClient = getD4HFetchClient(accessToken);

    const teams = await getD4HTeamsAccessibleWithToken(accessToken);

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
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    {
                        label: "D4H Access Tokens",
                        href: route("/main/[slug]/admin/d4h-access-tokens", { slug }),
                    },
                    {
                        label: accessToken.label || accessToken.id,
                        href: route("/main/[slug]/admin/d4h-access-tokens/[token_id]/members", {
                            slug,
                            token_id,
                        }),
                    },
                    "Members",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Teams with Members</Saratoga.Title>
                    </Saratoga.Header>
                    {members.map((member) => (
                        <div className="grid grid-cols-2 border-b py-2">
                            <div className="col-span-full py-2 font-semibold text-center">
                                {member.raw.id}
                            </div>
                            <div className="px-2 max-h-[50vh] overflow-y-auto">
                                <pre className="text-xs">{JSON.stringify(member.raw, null, 2)}</pre>
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
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
