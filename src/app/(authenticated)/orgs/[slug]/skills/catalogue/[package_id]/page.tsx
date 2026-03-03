/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skills/catalogue/[package_id]
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
import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";
import { MutationButton } from "@/components/ui/button";
import { toast } from "sonner";
import { Protect } from "@/components/protect";

export default function SkillsModule_CataloguePackage_Page(
    props: PageProps<`/orgs/[slug]/skills/catalogue/[package_id]`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const { data: packages } = useSuspenseQuery(
        trpc.skills.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    const skillPackage = packages.find((p) => p.id === package_id);
    if (!skillPackage)
        throw new Error(`Skill Package(${package_id}) not found`);

    const subscribeMutation = useMutation(
        trpc.skills.subscribeToPackage.mutationOptions({
            onError(error) {
                console.error("Failed to subscribe to skill package", error);
                toast.error("Failed to subscribe to skill package.");
            },
            onSuccess() {
                toast.success(
                    `Successfully subscribed to skill package "${skillPackage.name}".`,
                );
                queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const unsubscribeMutation = useMutation(
        trpc.skills.unsubscribeFromPackage.mutationOptions({
            onError(error) {
                console.error(
                    "Failed to unsubscribe from skill package",
                    error,
                );
                toast.error("Failed to unsubscribe from skill package.");
            },
            onSuccess() {
                toast.success(
                    `Successfully unsubscribed from skill package "${skillPackage.name}".`,
                );
                queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skills.index,
                    Paths.org(slug).skills.catalogue,
                    skillPackage.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.org(slug).skills.catalogue}
                        />
                        <Hermes.Title>{skillPackage.name}</Hermes.Title>
                        <Protect
                            orgId={organization.id}
                            permissions={{ skills: ["subscribe"] }}
                        >
                            <Hermes.Action>
                                {skillPackage.subscription ? (
                                    <MutationButton
                                        status={unsubscribeMutation.status}
                                        text={{
                                            idle: "Unsubscribe",
                                            pending: "Unsubscribing...",
                                            success: "Unsubscribed",
                                        }}
                                        onClick={() =>
                                            unsubscribeMutation.mutate({
                                                organizationId: organization.id,
                                                skillPackageId: skillPackage.id,
                                            })
                                        }
                                    />
                                ) : (
                                    <MutationButton
                                        status={subscribeMutation.status}
                                        text={{
                                            idle: "Subscribe",
                                            pending: "Subscribing...",
                                            success: "Subscribed",
                                        }}
                                        onClick={() =>
                                            subscribeMutation.mutate({
                                                organizationId: organization.id,
                                                skillPackageId: skillPackage.id,
                                            })
                                        }
                                    />
                                )}
                            </Hermes.Action>
                        </Protect>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Package Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Package ID</FieldLabel>
                                    <FieldValue
                                        value={skillPackage.id}
                                        format="id"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue>{skillPackage.name}</FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Description</FieldLabel>
                                    <FieldValue
                                        value={skillPackage.description}
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Publisher</FieldLabel>
                                    <FieldValue>
                                        {skillPackage.organization.name}
                                    </FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Skills</FieldLabel>
                                    <FieldValue>
                                        {skillPackage.skillCount}
                                    </FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Subscribers</FieldLabel>
                                    <FieldValue>
                                        {skillPackage.subscriptionCount}
                                    </FieldValue>
                                </Field>
                                <FieldSeparator />
                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={skillPackage.createdAt}
                                        format="dateTimeWithDistance"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated</FieldLabel>
                                    <FieldValue
                                        value={skillPackage.updatedAt}
                                        format="dateTimeWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    {skillPackage.subscription && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Subscription Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Subscription ID</FieldLabel>
                                        <FieldValue
                                            value={skillPackage.subscription.id}
                                            format="id"
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    )}
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
