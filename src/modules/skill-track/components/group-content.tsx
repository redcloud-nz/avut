/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { SkillPackageLink } from "@/components/entity-links/skill-package-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillTrack_SkillList } from "@/modules/skill-track/components/skill-list";
import { trpc } from "@/trpc/client";

export function SkillTrack_SkillGroup_Content({
    skillPackageId,
    skillGroupId,
}: {
    skillPackageId: SkillPackageId;
    skillGroupId: SkillGroupId;
}) {
    const organization = useOrganization();

    const { data: group } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.getGroup.queryOptions({
            organizationId: organization.id,
            skillPackageId,
            skillGroupId,
        }),
    );

    // Only a subscriber can see a group in a withdrawn (unpublished, archived or deleted) package.
    const withdrawn = !SkillPackage.isAvailable(group.skillPackage);

    const packageHref = route("/orgs/[slug]/skill-track/packages/[package_id]", {
        slug: organization.slug,
        package_id: group.skillPackageId,
    });

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Packages",
                        href: route("/orgs/[slug]/skill-track/packages", {
                            slug: organization.slug,
                        }),
                    },
                    { label: group.skillPackage.name, href: packageHref },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title
                    badges={group.status !== "Active" && <Badge variant="outline">Archived</Badge>}
                >
                    {group.name}
                </Saratoga.Title>
            </Saratoga.Header>
            {withdrawn && (
                <Alert variant="warning">
                    <AlertTitle>
                        {group.skillPackage.status === "Deleted"
                            ? "Its author has deleted this group's package"
                            : "Its author has withdrawn this group's package"}
                    </AlertTitle>
                    <AlertDescription>
                        {group.skillPackage.status === "Deleted"
                            ? "Its skills are out of your sessions and reports. Checks already recorded are kept."
                            : "Its skills are out of your sessions and reports until it's published again. Checks already recorded are kept."}
                    </AlertDescription>
                </Alert>
            )}
            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard label="Skill Group" updatedAt={group.updatedAt}>
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Group ID" id={group.id} />
                                <DataItem>
                                    <DataItemTitle>Name</DataItemTitle>
                                    <DataItemValue>{group.name}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Description</DataItemTitle>
                                    <DataItemValue>{group.description}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Package</DataItemTitle>
                                    <DataItemValue>
                                        <SkillPackageLink skillPackage={group.skillPackage} />
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Tags</DataItemTitle>
                                    <DataItemValue>
                                        {group.tags.length > 0 ? (
                                            <span className="flex flex-wrap gap-1">
                                                {group.tags.map((tag) => (
                                                    <Badge key={tag} variant="secondary">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </span>
                                        ) : (
                                            "None"
                                        )}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Included</DataItemTitle>
                                    <DataItemValue>
                                        {group.defaultInclude ? "Yes" : "No"}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
                    <section className="space-y-3 pt-4">
                        <h2 className="text-lg font-semibold tracking-tight">Skills</h2>
                        <SkillTrack_SkillList skills={group.skills} />
                    </section>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
