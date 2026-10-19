/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { SkillLink } from "@/components/entity-links/skill-link";
import { SkillPackageLink } from "@/components/entity-links/skill-package-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
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

    // Only a subscriber can see a group in a withdrawn (unpublished or archived) package.
    const withdrawn = !SkillPackage.isAvailable(group.skillPackage);

    const packageHref = route("/orgs/[slug]/skill-track/catalogue/[package_id]", {
        slug: organization.slug,
        package_id: group.skillPackageId,
    });

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
                    { label: group.skillPackage.name, href: packageHref },
                    group.name,
                ]}
                actions={<HelpButton id="skill-track/catalogue" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title className="flex items-center gap-2">
                            {group.name}
                            {group.status !== "Active" && <Badge variant="outline">Archived</Badge>}
                        </Saratoga.Title>
                    </Saratoga.Header>
                    {withdrawn && (
                        <p className="text-muted-foreground text-sm">
                            Its author has withdrawn this group&apos;s package. Its skills are out
                            of your sessions and reports until it&apos;s published again. Checks
                            already recorded are kept.
                        </p>
                    )}
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Group Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Group ID</DataItemTitle>
                                            <DataItemValue>{group.id}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{group.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Description</DataItemTitle>
                                            <DataItemValue>{group.description}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Package</DataItemTitle>
                                            <DataItemValue>
                                                <SkillPackageLink
                                                    skillPackage={group.skillPackage}
                                                />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
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
                                        <DataItem inline>
                                            <DataItemTitle>Included</DataItemTitle>
                                            <DataItemValue>
                                                {group.defaultInclude ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skills</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {group.skills.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">
                                            No skills in this group.
                                        </p>
                                    ) : (
                                        <ul className="divide-y rounded-md border">
                                            {group.skills.map((skill) => (
                                                <li key={skill.id} className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">
                                                            <SkillLink skill={skill} />
                                                        </span>
                                                        {skill.status !== "Active" && (
                                                            <Badge variant="outline">
                                                                Archived
                                                            </Badge>
                                                        )}
                                                        {skill.defaultRequired && (
                                                            <Badge variant="secondary">
                                                                Required
                                                            </Badge>
                                                        )}
                                                        {!skill.defaultInclude && (
                                                            <Badge variant="outline">
                                                                Not included by default
                                                            </Badge>
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
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={group.createdAt} />
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Updated</DataItemTitle>
                                            <DataItemDateValue date={group.updatedAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
