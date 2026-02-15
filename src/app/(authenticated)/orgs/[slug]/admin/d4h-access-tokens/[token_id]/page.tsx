/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens/[token_id]
 */
"use client";

import { use } from "react";

import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-api/servers";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

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
                    trpc.d4hAccessTokens.getOrganizationAccessToken.queryFilter(
                        {
                            organizationId: organization.id,
                            tokenId: token_id,
                        },
                    ),
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
                error: (error) =>
                    "Failed to refresh token metadata: " + error.message,
            },
        );
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.org(slug).admin.d4hAccessToken(token_id)
                            .href,
                        label: accessToken.label,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.d4hAccessTokens}
                            >
                                D4H Access Tokens
                            </Hermes.BackButton>

                            <Protect
                                orgId={organization.id}
                                permissions={{ d4hAccessToken: ["update"] }}
                            >
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleRefresh}
                                >
                                    <RefreshCwIcon />
                                </Button>
                            </Protect>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>D4H Access Token</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Token ID</FieldLabel>
                                        <FieldValue
                                            value={accessToken.id}
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Server</FieldLabel>
                                        <FieldValue
                                            value={
                                                getD4HServer(
                                                    accessToken.serverCode,
                                                )?.name!
                                            }
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Label</FieldLabel>
                                        <FieldValue
                                            value={accessToken.label}
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Status</FieldLabel>
                                        <FieldValue
                                            value={accessToken.status}
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created At</FieldLabel>
                                        <FieldValue
                                            value={accessToken.createdAt}
                                            format="date"
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.SectionTitle>
                                Organizations
                            </Hermes.SectionTitle>
                        </Hermes.SectionHeader>
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
                                {accessToken.metadata.d4HOrganizations.map(
                                    (org) => (
                                        <TableRow key={org.id}>
                                            <TableCell className="text-center">
                                                {org.id}
                                            </TableCell>
                                            <TableCell>{org.title}</TableCell>
                                        </TableRow>
                                    ),
                                )}
                            </TableBody>
                        </Table>
                    </Hermes.Section>
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.SectionTitle>Teams</Hermes.SectionTitle>
                        </Hermes.SectionHeader>
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
                                {accessToken.metadata.d4HTeams.map((team) => (
                                    <TableRow key={team.id}>
                                        <TableCell className="text-center">
                                            {team.id}
                                        </TableCell>
                                        <TableCell>{team.title}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
