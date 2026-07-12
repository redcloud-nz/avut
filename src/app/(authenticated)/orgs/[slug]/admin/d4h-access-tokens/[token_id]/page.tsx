/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens/[token_id]
 */
"use client";

import { RefreshCwIcon } from "lucide-react";
import { use } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export default function AdminModule_D4hAccessToken_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]`>,
) {
    const { slug, token_id } = use(props.params);
    const organization = useOrganization();

    const queryClient = useQueryClient();

    const { data: accessToken } = useSuspenseQuery(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId: token_id,
        }),
    );

    const refreshMutation = useMutation(
        trpc.d4hAccessTokens.refreshToken.mutationOptions({
            onSettled() {
                queryClient.invalidateQueries(
                    trpc.d4hAccessTokens.getOrganizationAccessToken.queryFilter({
                        organizationId: organization.id,
                        tokenId: token_id,
                    }),
                );
            },
        }),
    );

    function handleRefresh() {
        toast.promise(
            refreshMutation.mutateAsync({
                organizationId: organization.id,
                tokenId: token_id,
            }),
            {
                loading: "Refreshing token metadata...",
                success: "Token metadata refreshed",
                error: (error) => "Failed to refresh token metadata: " + error.message,
            },
        );
    }

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    {
                        label: "D4H Access Tokens",
                        href: route("/orgs/[slug]/admin/d4h-access-tokens", { slug }),
                    },
                    accessToken.label || `Access Token: ${accessToken.id}`,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            {accessToken.label || `Access Token: ${accessToken.id}`}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect
                                orgId={organization.id}
                                permissions={{ d4hAccessToken: ["update"] }}
                            >
                                <Button variant="ghost" size="icon" onClick={handleRefresh}>
                                    <RefreshCwIcon />
                                </Button>
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>D4H Access Token</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Token ID</DLTerm>
                                        <DLDetails>{accessToken.id}</DLDetails>
                                        <DLTerm>Server</DLTerm>
                                        <DLDetails>
                                            {getD4HServer(accessToken.serverCode)?.name}
                                        </DLDetails>
                                        <DLTerm>Label</DLTerm>
                                        <DLDetails>{accessToken.label}</DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{accessToken.status}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            {/* <Card>
                                <CardHeader>
                                    <CardTitle>Organizations</CardTitle>
                                    <CardDescription>
                                        List of organizations accessible with this
                                        access token.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeadCell className="text-center w-20">
                                                    D4H ID
                                                </TableHeadCell>
                                                <TableHeadCell>Name</TableHeadCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {accessToken.metadata.d4HOrganisations.map(
                                                (org) => (
                                                    <TableRow key={org.id}>
                                                        <TableCell className="text-center">
                                                            {org.id}
                                                        </TableCell>
                                                        <TableCell>
                                                            {org.title}
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card> */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Teams</CardTitle>
                                    <CardDescription>
                                        List of teams accessible with this access token.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeadCell className="text-center w-20">
                                                    D4H ID
                                                </TableHeadCell>
                                                <TableHeadCell>Name</TableHeadCell>
                                                <TableHeadCell>Organization</TableHeadCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {accessToken.metadata.d4HTeams.map((team) => (
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
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(accessToken.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(accessToken.createdAt)}
                                            </div>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
