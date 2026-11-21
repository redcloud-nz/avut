/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { D4HAccessToken } from "@/lib/schemas/d4h-access-token";
import { ProviderCredentialAccess, ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

import {
    PersonalD4HAccessTokenAction,
    UserSettings_D4HAccessToken_Menu,
} from "./d4h-access-token-menu";

export function UserSettings_D4HAccessTokenContent({ tokenId }: { tokenId: ProviderCredentialId }) {
    const { data: tokens } = useSuspenseQuery(
        trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions(),
    );
    const token = tokens.find((t) => t.id === tokenId);
    const [, setAction] = useQueryState("action", PersonalD4HAccessTokenAction);

    const refreshMutation = useMutation(
        trpc.d4hAccessTokens.refreshPersonalAccessToken.mutationOptions({
            meta: { effects: d4hAccessTokensEffects.refreshPersonalAccessToken },
        }),
    );

    if (!token) notFound();

    const handleRefresh = () => {
        toast.promise(
            refreshMutation.mutateAsync({
                organizationId: token.organization.id,
                tokenId: token.id,
            }),
            {
                loading: "Refreshing token metadata...",
                success: "Token metadata refreshed",
                error: (error) => "Failed to refresh token metadata: " + error.message,
            },
        );
    };

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    { label: "D4H", href: "/user/settings/d4h" },
                    { label: "Access Tokens", href: "/user/settings/d4h" },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title
                    badges={
                        !D4HAccessToken.isStatusOk(token.status) && (
                            <Badge variant="outline">{token.status}</Badge>
                        )
                    }
                >
                    D4H Personal Access Token
                </Saratoga.Title>
                <Saratoga.Actions>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleRefresh}
                                disabled={refreshMutation.isPending}
                                aria-label="Refresh from D4H"
                            >
                                <RefreshCwIcon />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Refresh from D4H</TooltipContent>
                    </Tooltip>
                    <UserSettings_D4HAccessToken_Menu token={token} onRefresh={handleRefresh} />
                </Saratoga.Actions>
            </Saratoga.Header>
            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard
                        label="D4H Access Token"
                        updatedAt={token.updatedAt}
                        action={
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit access token"
                                onClick={() => void setAction("edit", { history: "push" })}
                            >
                                <ObjectIcons.Edit />
                            </Button>
                        }
                    >
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Token ID" id={token.id} />
                                <DataItem>
                                    <DataItemTitle>Label</DataItemTitle>
                                    <DataItemValue>{token.label}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Access</DataItemTitle>
                                    <DataItemValue>
                                        {ProviderCredentialAccess.labels[token.access]}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Organisation</DataItemTitle>
                                    <DataItemValue>
                                        <Link
                                            href={route(
                                                "/user/settings/organizations/[organization_id]",
                                                { organization_id: token.organization.id },
                                            )}
                                        >
                                            {token.organization.name}
                                        </Link>
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Server</DataItemTitle>
                                    <DataItemValue>
                                        {getD4HServer(token.serverCode)?.name}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
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
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
