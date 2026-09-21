/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { trpc } from "@/trpc/client";

import { UserSettings_D4HAccessTokenMenu } from "./d4h-access-token-menu";

export function UserSettings_D4HAccessTokenContent({ tokenId }: { tokenId: D4HAccessTokenId }) {
    const { data: tokens } = useSuspenseQuery(
        trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions(),
    );
    const token = tokens.find((t) => t.id === tokenId);

    if (!token) notFound();

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "User Settings", href: "/user/settings" },
                    { label: "D4H", href: "/user/settings/d4h" },
                    "Access Tokens",
                    token.id,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>D4H Personal Access Token</Saratoga.Title>
                        <Saratoga.Actions>
                            <UserSettings_D4HAccessTokenMenu token={token} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Token Details</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Token ID</DLTerm>
                                        <DLDetails>{token.id}</DLDetails>
                                        <DLTerm>Organisation</DLTerm>
                                        <DLDetails>
                                            <Link
                                                href={route(
                                                    "/user/settings/organizations/[organization_id]",
                                                    { organization_id: token.organization.id },
                                                )}
                                            >
                                                {token.organization.name}
                                            </Link>
                                        </DLDetails>
                                        <DLTerm>Server</DLTerm>
                                        <DLDetails>
                                            {getD4HServer(token.serverCode)?.name}
                                        </DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>
                                            <Badge variant="outline">{token.status}</Badge>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            {token.metadata.d4HTeams.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Teams</CardTitle>
                                        <CardDescription>
                                            Teams accessible with this access token.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHeadCell className="w-20 text-center">
                                                        D4H ID
                                                    </TableHeadCell>
                                                    <TableHeadCell>Name</TableHeadCell>
                                                    <TableHeadCell>Organisation</TableHeadCell>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {token.metadata.d4HTeams.map((team) => (
                                                    <TableRow key={team.id}>
                                                        <TableCell className="text-center">
                                                            {team.id}
                                                        </TableCell>
                                                        <TableCell>{team.title}</TableCell>
                                                        <TableCell>{team.owner?.title}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDateDetails date={token.createdAt} />
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
