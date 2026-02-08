/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens/[token_id]
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-api/servers";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function AdminModule_D4hAccessToken_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]`>,
) {
    const { slug, token_id } = use(props.params);
    const organization = useOrganization();

    const {
        data: { token },
    } = useSuspenseQuery(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId: token_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.org(slug).admin.d4hAccessToken(token_id)
                            .href,
                        label: token.label,
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
                                            value={token.id}
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Server</FieldLabel>
                                        <FieldValue
                                            value={
                                                getD4HServer(token.serverCode)
                                                    ?.name!
                                            }
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Label</FieldLabel>
                                        <FieldValue
                                            value={token.label}
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Status</FieldLabel>
                                        <FieldValue
                                            value={token.status}
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created At</FieldLabel>
                                        <FieldValue
                                            value={token.createdAt}
                                            format="date"
                                            className="min-w-1/2"
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
