/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { SkillId } from "@/lib/schemas/skill";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_Skill_Content({ skillId }: { skillId: SkillId }) {
    const organization = useOrganization();

    const { data: skill } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    // Only a subscriber can see a skill in a withdrawn (unpublished or archived) package.
    const withdrawn = !SkillPackage.isAvailable(skill.skillPackage);

    // As in the Skills list: a skill counts as archived when it, or its (not Deleted) group, is.
    const archived =
        skill.status !== "Active" || (skill.group !== null && skill.group.status !== "Active");

    // The coverage report covers only Active skills in available packages the organization
    // subscribes to; for anything else it would show "Unknown Skill".
    const coverageAvailable = skill.subscribed && !withdrawn && skill.status === "Active";

    const frequency =
        skill.frequency > 0
            ? `${skill.frequency} ${skill.frequency === 1 ? "month" : "months"}`
            : "None";

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Track",
                        href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
                    },
                    {
                        label: "Skills",
                        href: route("/orgs/[slug]/skill-track/skills", {
                            slug: organization.slug,
                        }),
                    },
                    skill.name,
                ]}
                actions={<HelpButton id="skill-track/skills" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title className="flex items-center gap-2">
                            {skill.name}
                            {archived && <Badge variant="outline">Archived</Badge>}
                        </Saratoga.Title>
                        {coverageAvailable && (
                            <Saratoga.Actions>
                                <Protect permissions={{ skillCheck: ["view"] }}>
                                    <Button asChild variant="outline">
                                        <Link
                                            href={`${route("/orgs/[slug]/skill-track/reports/skill", { slug: organization.slug })}?skill=${skill.id}`}
                                        >
                                            Skill Coverage
                                        </Link>
                                    </Button>
                                </Protect>
                            </Saratoga.Actions>
                        )}
                    </Saratoga.Header>
                    {withdrawn && (
                        <p className="text-muted-foreground text-sm">
                            Its author has withdrawn this skill&apos;s package. Its skills are out
                            of your sessions and reports until it&apos;s published again. Checks
                            already recorded are kept.
                        </p>
                    )}
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skill Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{skill.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Description</DataItemTitle>
                                            <DataItemValue>{skill.description}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Group</DataItemTitle>
                                            <DataItemValue>
                                                {skill.group ? (
                                                    <Link
                                                        href={route(
                                                            "/orgs/[slug]/skill-track/catalogue/[package_id]/groups/[group_id]",
                                                            {
                                                                slug: organization.slug,
                                                                package_id: skill.skillPackageId,
                                                                group_id: skill.group.id,
                                                            },
                                                        )}
                                                    >
                                                        {skill.group.name}
                                                    </Link>
                                                ) : (
                                                    "—"
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Package</DataItemTitle>
                                            <DataItemValue>
                                                <Link
                                                    href={route(
                                                        "/orgs/[slug]/skill-track/catalogue/[package_id]",
                                                        {
                                                            slug: organization.slug,
                                                            package_id: skill.skillPackageId,
                                                        },
                                                    )}
                                                >
                                                    {skill.skillPackage.name}
                                                </Link>
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Frequency</DataItemTitle>
                                            <DataItemValue>{frequency}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Tags</DataItemTitle>
                                            <DataItemValue>
                                                {skill.tags.length > 0 ? (
                                                    <span className="flex flex-wrap gap-1">
                                                        {skill.tags.map((tag) => (
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
                                            <DataItemTitle>Required</DataItemTitle>
                                            <DataItemValue>
                                                {skill.defaultRequired ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Included by default</DataItemTitle>
                                            <DataItemValue>
                                                {skill.defaultInclude ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Skill ID</DataItemTitle>
                                            <DataItemValue>{skill.id}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={skill.createdAt} />
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Updated</DataItemTitle>
                                            <DataItemDateValue date={skill.updatedAt} />
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
