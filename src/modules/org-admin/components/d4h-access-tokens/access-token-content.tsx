/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { RefreshCwIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { D4HAccessTokenStatusBadge } from "@/components/ui/status-badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { ProviderCredentialAccess, ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

import { AdminModule_D4HAccessToken_Menu, D4HAccessTokenAction } from "./d4h-access-token-menu";

export function AdminModule_D4HAccessToken_Content({ tokenId }: { tokenId: ProviderCredentialId }) {
    const organization = useOrganization();
    const [, setAction] = useQueryState("action", D4HAccessTokenAction);

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
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "D4H Access Tokens",
                        href: route("/orgs/[slug]/admin/d4h-access-tokens", {
                            slug: organization.slug,
                        }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title badges={<D4HAccessTokenStatusBadge status={accessToken.status} />}>
                    {accessToken.label || `Access Token: ${accessToken.id}`}
                </Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ organization: ["update"] }}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Refresh from D4H"
                                    onClick={handleRefresh}
                                >
                                    <RefreshCwIcon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Refresh from D4H</TooltipContent>
                        </Tooltip>
                    </Protect>
                    <AdminModule_D4HAccessToken_Menu
                        token={accessToken}
                        onRefresh={handleRefresh}
                    />
                </Saratoga.Actions>
            </Saratoga.Header>
            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard
                        label="D4H Access Token"
                        updatedAt={accessToken.updatedAt}
                        historyHref={route(
                            "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/history",
                            { slug: organization.slug, token_id: accessToken.id },
                        )}
                        action={
                            <Protect permissions={{ organization: ["update"] }}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Edit access token"
                                    onClick={() => void setAction("edit", { history: "push" })}
                                >
                                    <ObjectIcons.Edit />
                                </Button>
                            </Protect>
                        }
                    >
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Token ID" id={accessToken.id} />
                                <DataItem>
                                    <DataItemTitle>Label</DataItemTitle>
                                    <DataItemValue>{accessToken.label}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Server</DataItemTitle>
                                    <DataItemValue>
                                        {getD4HServer(accessToken.serverCode)?.name}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Access</DataItemTitle>
                                    <DataItemValue>
                                        {ProviderCredentialAccess.labels[accessToken.access]}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
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
                                            <TableCell className="text-center">{team.id}</TableCell>
                                            <TableCell>{team.title}</TableCell>
                                            <TableCell>{team.owner?.title}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
