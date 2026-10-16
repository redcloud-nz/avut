/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

export function AdminModule_D4HAccessToken_Content({ tokenId }: { tokenId: ProviderCredentialId }) {
    const organization = useOrganization();

    const { data: accessToken } = useSuspenseQuery(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId,
        }),
    );

    const refreshMutation = useMutation(
        trpc.d4hAccessTokens.refreshToken.mutationOptions({
            meta: { effects: d4hAccessTokensEffects.refreshToken },
        }),
    );

    function handleRefresh() {
        toast.promise(
            refreshMutation.mutateAsync({
                organizationId: organization.id,
                tokenId,
            }),
            {
                loading: "Refreshing token metadata...",
                success: "Token metadata refreshed",
                error: (error) => "Failed to refresh token metadata: " + error.message,
            },
        );
    }

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "D4H Access Tokens",
                        href: route("/orgs/[slug]/admin/d4h-access-tokens", {
                            slug: organization.slug,
                        }),
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
                            <Protect permissions={{ organization: ["update"] }}>
                                <Button variant="ghost" size="icon" asChild>
                                    <Link
                                        href={route(
                                            "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/history",
                                            { slug: organization.slug, token_id: tokenId },
                                        )}
                                        aria-label="History"
                                        title="History"
                                    >
                                        <ObjectIcons.History />
                                    </Link>
                                </Button>
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
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Token ID</DataItemTitle>
                                            <DataItemValue>{accessToken.id}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Server</DataItemTitle>
                                            <DataItemValue>
                                                {getD4HServer(accessToken.serverCode)?.name}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Label</DataItemTitle>
                                            <DataItemValue>{accessToken.label}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>{accessToken.status}</DataItemValue>
                                        </DataItem>
                                    </DataList>
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
                                                <TableHeadCell>Organisation</TableHeadCell>
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
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={accessToken.createdAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
