/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { SkillGroupLink } from "@/components/entity-links/skill-group-link";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { EntityActionMenu } from "@/components/ui/menu-action";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { SkillPackageAvailabilityBadge } from "@/components/ui/status-badge";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillTrack_SkillList } from "@/modules/skill-track/components/skill-list";
import { SkillTrack_SubscribeToPackage_Dialog } from "@/modules/skill-track/components/subscribe-package";
import { SkillTrack_UnsubscribeFromPackage_Dialog } from "@/modules/skill-track/components/unsubscribe-package";
import { trpc, type RouterOutput } from "@/trpc/client";

type PackageGroupData = RouterOutput["skillPackageSubscriptions"]["getPackage"]["groups"][number];

export function SkillTrack_Package_Content({ skillPackageId }: { skillPackageId: SkillPackageId }) {
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    // Only a subscriber can see a withdrawn (unpublished, archived or deleted) package: it can
    // leave it, but not subscribe again.
    const withdrawn = !SkillPackage.isAvailable(skillPackage);

    // The subscribe/unsubscribe dialogs are host-driven: their own success
    // effect flips `skillPackage.subscription`, which swaps the trigger button —
    // if a dialog owned the param it would be clearing it from an unmounted hook.
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["subscribe", "unsubscribe"] as const),
    );

    const canSubscribe = useHasPermission({ skillPackageSubscription: ["subscribe"] });

    return (
        <>
            <Saratoga.Root>
                <Saratoga.Breadcrumbs
                    items={[
                        {
                            label: "Packages",
                            href: route("/orgs/[slug]/skill-track/packages", {
                                slug: organization.slug,
                            }),
                        },
                    ]}
                />
                <Saratoga.Header>
                    <Saratoga.Title
                        badges={<SkillPackageAvailabilityBadge skillPackage={skillPackage} />}
                    >
                        {skillPackage.name}
                    </Saratoga.Title>
                    <Saratoga.Actions>
                        {!skillPackage.subscription && !withdrawn && (
                            <Protect permissions={{ skillPackageSubscription: ["subscribe"] }}>
                                <Button
                                    variant="outline"
                                    onClick={() => void setAction("subscribe", { history: "push" })}
                                >
                                    Subscribe
                                </Button>
                            </Protect>
                        )}
                        {skillPackage.subscription && (
                            <EntityActionMenu
                                category="Packages"
                                actions={[
                                    {
                                        verb: "unsubscribe",
                                        label: "Unsubscribe",
                                        icon: <ObjectIcons.Unsubscribe />,
                                        onSelect: () =>
                                            void setAction("unsubscribe", { history: "push" }),
                                        disabled: !canSubscribe,
                                        destructive: true,
                                    },
                                ]}
                            />
                        )}
                    </Saratoga.Actions>
                </Saratoga.Header>
                {withdrawn && (
                    <Alert variant="warning">
                        <AlertTitle>
                            {skillPackage.status === "Deleted"
                                ? "Its author has deleted this package"
                                : "Its author has withdrawn this package"}
                        </AlertTitle>
                        <AlertDescription>
                            {skillPackage.status === "Deleted"
                                ? "Its skills are out of your sessions and reports. Checks already recorded are kept."
                                : "Its skills are out of your sessions and reports until it's published again. Checks already recorded are kept."}
                        </AlertDescription>
                    </Alert>
                )}
                <Saratoga.Columns>
                    <Saratoga.Column slot="main">
                        <RecordCard label="Skill Package" updatedAt={skillPackage.updatedAt}>
                            <CardContent>
                                <DataList>
                                    <RecordCardId label="Package ID" id={skillPackage.id} />
                                    <DataItem>
                                        <DataItemTitle>Name</DataItemTitle>
                                        <DataItemValue>{skillPackage.name}</DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Description</DataItemTitle>
                                        <DataItemValue>{skillPackage.description}</DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Publisher</DataItemTitle>
                                        <DataItemValue>
                                            {skillPackage.organization.name}
                                        </DataItemValue>
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </RecordCard>
                        {skillPackage.subscription && (
                            <RecordCard
                                label="Subscription"
                                updatedAt={skillPackage.subscription.updatedAt}
                            >
                                <CardContent>
                                    <DataList>
                                        <RecordCardId
                                            label="Subscription ID"
                                            id={skillPackage.subscription.id}
                                        />
                                        <DataItem>
                                            <DataItemTitle>Subscribed</DataItemTitle>
                                            <DataItemDateValue
                                                date={skillPackage.subscription.createdAt}
                                            />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </RecordCard>
                        )}
                        <section className="space-y-4 pt-4">
                            <h2 className="text-lg font-semibold tracking-tight">Contents</h2>
                            {skillPackage.groups.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    This package has no groups or skills yet.
                                </p>
                            ) : (
                                <div className="space-y-8">
                                    {skillPackage.groups.map((group) => (
                                        <PackageGroup
                                            key={group.id}
                                            group={group}
                                            skillPackageId={skillPackage.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </Saratoga.Column>
                    <Saratoga.Column slot="secondary">
                        <div className="grid grid-cols-2 gap-2">
                            <Metric label="Skills" value={skillPackage.skillCount} />
                            <Metric label="Subscribers" value={skillPackage.subscriptionCount} />
                        </div>
                    </Saratoga.Column>
                </Saratoga.Columns>
            </Saratoga.Root>

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

/** A compact count tile for the secondary column: the number, then its label. */
function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-2xl font-semibold leading-tight tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function PackageGroup({
    group,
    skillPackageId,
}: {
    group: PackageGroupData;
    skillPackageId: SkillPackageId;
}) {
    return (
        <div className="space-y-3">
            <div>
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">
                        <SkillGroupLink group={{ ...group, skillPackageId }} />
                    </h3>
                    {!group.defaultInclude && (
                        <Badge variant="outline">Not included by default</Badge>
                    )}
                </div>
                {group.description && (
                    <p className="text-muted-foreground mt-0.5 text-sm">{group.description}</p>
                )}
            </div>
            <SkillTrack_SkillList skills={group.skills} />
        </div>
    );
}
