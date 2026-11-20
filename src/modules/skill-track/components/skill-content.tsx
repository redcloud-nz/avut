/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { SkillGroupLink } from "@/components/entity-links/skill-group-link";
import { SkillPackageLink } from "@/components/entity-links/skill-package-link";
import { Protect } from "@/components/protect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { formatFrequency } from "@/modules/skill-track/lib/format-frequency";
import { trpc } from "@/trpc/client";

export function SkillTrack_Skill_Content({ skillId }: { skillId: SkillId }) {
    const organization = useOrganization();

    const { data: skill } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    // Only a subscriber can see a skill in a withdrawn (unpublished, archived or deleted) package.
    const withdrawn = !SkillPackage.isAvailable(skill.skillPackage);

    // A skill counts as archived when it, or its group, is. Either way it's out of the Skills
    // list, sessions and reports.
    const archived = skill.status !== "Active" || skill.group.status !== "Active";

    // The coverage report covers only Active skills in Active groups of available packages the
    // organization subscribes to; for anything else it would show "Unknown Skill".
    const coverageAvailable = skill.subscribed && !withdrawn && !archived;

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
                        <Saratoga.Title
                            badges={archived && <Badge variant="outline">Archived</Badge>}
                        >
                            {skill.name}
                        </Saratoga.Title>
                    </Saratoga.Header>
                    {withdrawn && (
                        <Alert variant="warning">
                            <AlertTitle>
                                {skill.skillPackage.status === "Deleted"
                                    ? "Its author has deleted this skill's package"
                                    : "Its author has withdrawn this skill's package"}
                            </AlertTitle>
                            <AlertDescription>
                                {skill.skillPackage.status === "Deleted"
                                    ? "Its skills are out of your sessions and reports. Checks already recorded are kept."
                                    : "Its skills are out of your sessions and reports until it's published again. Checks already recorded are kept."}
                            </AlertDescription>
                        </Alert>
                    )}
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <RecordCard label="Skill" updatedAt={skill.updatedAt}>
                                <CardContent>
                                    <DataList>
                                        <RecordCardId label="Skill ID" id={skill.id} />
                                        <DataItem>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{skill.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Description</DataItemTitle>
                                            <DataItemValue>{skill.description}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Package</DataItemTitle>
                                            <DataItemValue>
                                                <SkillPackageLink
                                                    skillPackage={skill.skillPackage}
                                                />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Group</DataItemTitle>
                                            <DataItemValue>
                                                <SkillGroupLink group={skill.group} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Frequency</DataItemTitle>
                                            <DataItemValue>
                                                {formatFrequency(skill.frequency)}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
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
                                        <DataItem>
                                            <DataItemTitle>Required</DataItemTitle>
                                            <DataItemValue>
                                                {skill.defaultRequired ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Included</DataItemTitle>
                                            <DataItemValue>
                                                {skill.defaultInclude ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </RecordCard>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            {/* Recent checks shows for every skill, archived and withdrawn ones
                                included, since their history is what it's for. Skill Coverage
                                shows only for a skill that can still be assessed. */}
                            <Protect permissions={{ skillCheck: ["view"] }}>
                                <section aria-label="Related">
                                    <ItemGroup className="gap-2">
                                        {coverageAvailable && (
                                            <Item variant="outline" role="listitem" asChild>
                                                <Link
                                                    href={`${route("/orgs/[slug]/skill-track/reports/skill", { slug: organization.slug })}?skill=${skill.id}`}
                                                >
                                                    <ItemContent>
                                                        <ItemTitle>Skill Coverage</ItemTitle>
                                                        <ItemDescription>
                                                            who holds this skill
                                                        </ItemDescription>
                                                    </ItemContent>
                                                    <ItemActions>
                                                        <ChevronRightIcon
                                                            aria-hidden
                                                            className="text-muted-foreground size-4"
                                                        />
                                                    </ItemActions>
                                                </Link>
                                            </Item>
                                        )}
                                        <Item variant="outline" role="listitem" asChild>
                                            <Link
                                                href={`${route("/orgs/[slug]/skill-track/checks", { slug: organization.slug })}?skill=${skill.id}`}
                                            >
                                                <ItemContent>
                                                    <ItemTitle>Recent checks</ItemTitle>
                                                    <ItemDescription>
                                                        checks of this skill
                                                    </ItemDescription>
                                                </ItemContent>
                                                <ItemActions>
                                                    <ChevronRightIcon
                                                        aria-hidden
                                                        className="text-muted-foreground size-4"
                                                    />
                                                </ItemActions>
                                            </Link>
                                        </Item>
                                    </ItemGroup>
                                </section>
                            </Protect>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
