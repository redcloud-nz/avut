/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { SkillTrack_SubscribeToPackage_Dialog } from "@/components/skill-track/subscribe-package";
import { SkillTrack_UnsubscribeFromPackage_Dialog } from "@/components/skill-track/unsubscribe-package";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc, type RouterOutput } from "@/trpc/client";

type CataloguePackageGroup = RouterOutput["skills"]["getPackage"]["groups"][number];

export function SkillTrack_CataloguePackage_Content({
    skillPackageId,
}: {
    skillPackageId: SkillPackageId;
}) {
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skills.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    // The subscribe/unsubscribe dialogs are host-driven: their own success
    // effect flips `skillPackage.subscription`, which swaps the trigger button —
    // if a dialog owned the param it would be clearing it from an unmounted hook.
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["subscribe", "unsubscribe"] as const),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Track",
                        href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
                    },
                    {
                        label: "Catalogue",
                        href: route("/orgs/[slug]/skill-track/catalogue", {
                            slug: organization.slug,
                        }),
                    },
                    skillPackage.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skillPackage.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ skillPackageSubscription: ["subscribe"] }}>
                                {skillPackage.subscription ? (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            void setAction("unsubscribe", { history: "push" })
                                        }
                                    >
                                        Unsubscribe
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            void setAction("subscribe", { history: "push" })
                                        }
                                    >
                                        Subscribe
                                    </Button>
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
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contents</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {skillPackage.groups.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">
                                            This package has no groups or skills yet.
                                        </p>
                                    ) : (
                                        skillPackage.groups.map((group) => (
                                            <PackageGroup key={group.id} group={group} />
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        {skillPackage.subscription && (
                                            <>
                                                <DLTerm>Subscription ID</DLTerm>
                                                <DLDetails>
                                                    {skillPackage.subscription.id}
                                                </DLDetails>
                                            </>
                                        )}
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

            <SkillTrack_SubscribeToPackage_Dialog
                skillPackage={skillPackage}
                open={action === "subscribe"}
                onOpenChange={(open) =>
                    void setAction(open ? "subscribe" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillTrack_UnsubscribeFromPackage_Dialog
                skillPackage={skillPackage}
                open={action === "unsubscribe"}
                onOpenChange={(open) =>
                    void setAction(open ? "unsubscribe" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}

function PackageGroup({ group }: { group: CataloguePackageGroup }) {
    return (
        <div>
            <div className="flex items-center gap-2">
                <h3 className="font-medium">{group.name}</h3>
                {!group.defaultInclude && <Badge variant="outline">Not included by default</Badge>}
            </div>
            {group.description && (
                <p className="text-muted-foreground mt-0.5 text-sm">{group.description}</p>
            )}
            {group.skills.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-sm">No skills in this group.</p>
            ) : (
                <ul className="mt-2 divide-y rounded-md border">
                    {group.skills.map((skill) => (
                        <li key={skill.id} className="px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{skill.name}</span>
                                {skill.defaultRequired && (
                                    <Badge variant="secondary">Required</Badge>
                                )}
                                {!skill.defaultInclude && (
                                    <Badge variant="outline">Not included by default</Badge>
                                )}
                            </div>
                            {skill.description && (
                                <p className="text-muted-foreground mt-0.5 text-sm">
                                    {skill.description}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
