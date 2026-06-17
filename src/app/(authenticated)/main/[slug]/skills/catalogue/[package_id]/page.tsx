/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skills/catalogue/[package_id]
 */
"use client";

import { use } from "react";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export default function SkillsModule_CataloguePackage_Page(
    props: PageProps<`/main/[slug]/skills/catalogue/[package_id]`>,
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
    if (!skillPackage) throw new Error(`Skill Package(${package_id}) not found`);

    const subscribeMutation = useMutation(
        trpc.skills.subscribeToPackage.mutationOptions({
            onError(error) {
                console.error("Failed to subscribe to skill package", error);
                toast.error("Failed to subscribe to skill package.");
            },
            onSuccess() {
                toast.success(`Successfully subscribed to skill package "${skillPackage.name}".`);
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
                console.error("Failed to unsubscribe from skill package", error);
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
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Catalogue", href: route("/main/[slug]/skills/catalogue", { slug }) },
                    skillPackage.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skillPackage.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect
                                orgId={organization.id}
                                permissions={{ skillPackageSubscription: ["subscribe"] }}
                            >
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
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Package Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Package ID</DLTerm>
                                        <DLDetails>{skillPackage.id}</DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{skillPackage.name}</DLDetails>
                                        <DLTerm>Description</DLTerm>
                                        <DLDetails>{skillPackage.description}</DLDetails>
                                        <DLTerm>Publisher</DLTerm>
                                        <DLDetails>{skillPackage.organization.name}</DLDetails>
                                        <DLTerm>Skills</DLTerm>
                                        <DLDetails>{skillPackage.skillCount}</DLDetails>
                                        <DLTerm>Subscribers</DLTerm>
                                        <DLDetails>{skillPackage.subscriptionCount}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            {skillPackage.subscription && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Subscription Information</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DL>
                                            <DLTerm>Subscription ID</DLTerm>
                                            <DLDetails>{skillPackage.subscription.id}</DLDetails>
                                        </DL>
                                    </CardContent>
                                </Card>
                            )}
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skillPackage.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skillPackage.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skillPackage.updatedAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skillPackage.updatedAt)}
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
