/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/d4h-access-tokens/[token_id]
 */
"use client";

import { RefreshCwIcon } from "lucide-react";
import { use } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
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
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function AdminModule_D4hAccessToken_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]`>,
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
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.main(slug).admin.d4hAccessToken(token_id).href,
                        label: accessToken.label,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.main(slug).admin.d4hAccessTokens}
                            tooltip="Back to access token list"
                        />
                        <Hermes.Title>
                            {accessToken.label || `Access Token: ${accessToken.id}`}
                        </Hermes.Title>

                        <Protect
                            orgId={organization.id}
                            permissions={{ d4hAccessToken: ["update"] }}
                        >
                            <Hermes.Action>
                                <Button variant="ghost" size="icon" onClick={handleRefresh}>
                                    <RefreshCwIcon />
                                </Button>
                            </Hermes.Action>
                        </Protect>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>D4H Access Token</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Token ID</FieldLabel>
                                    <FieldValue value={accessToken.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Server</FieldLabel>
                                    <FieldValue
                                        value={getD4HServer(accessToken.serverCode)?.name!}
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Label</FieldLabel>
                                    <FieldValue value={accessToken.label} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={accessToken.status} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={accessToken.createdAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
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
                                            <TableCell className="text-center">{team.id}</TableCell>
                                            <TableCell>{team.title}</TableCell>
                                            <TableCell>{team.owner?.title}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
