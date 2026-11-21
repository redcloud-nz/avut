/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { RecordStatusBadge } from "@/components/ui/status-badge";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Skill_Menu } from "./skill-menu";
import { SkillPackageBuilder_UpdateSkill_Dialog } from "./update-skill";

export function SkillPackageBuilder_Skill_Content({ skillId }: { skillId: SkillId }) {
    const organization = useOrganization();

    const { data: skill } = useSuspenseQuery(
        trpc.skillPackageBuilder.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: skill.skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skill.skillPackageId,
                        }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title badges={<RecordStatusBadge status={skill.status} />}>
                    {skill.name}
                </Saratoga.Title>
                <Saratoga.Actions>
                    <SkillPackageBuilder_Skill_Menu skill={skill} />
                </Saratoga.Actions>
            </Saratoga.Header>
            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard
                        label="Skill"
                        updatedAt={skill.updatedAt}
                        historyHref={route(
                            "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/history",
                            {
                                slug: organization.slug,
                                package_id: skill.skillPackageId,
                                skill_id: skill.id,
                            },
                        )}
                        action={
                            <Protect permissions={{ skillPackage: ["update"] }}>
                                <SkillPackageBuilder_UpdateSkill_Dialog skill={skill} />
                            </Protect>
                        }
                    >
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Skill ID" id={skill.id} />
                                <DataItem>
                                    <DataItemTitle>Name</DataItemTitle>
                                    <DataItemValue>{skill.name}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Package</DataItemTitle>
                                    <DataItemValue>
                                        <Link
                                            href={route(
                                                "/orgs/[slug]/skill-package-builder/packages/[package_id]",
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
                                <DataItem>
                                    <DataItemTitle>Group</DataItemTitle>
                                    <DataItemValue>
                                        <Link
                                            href={route(
                                                "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                                                {
                                                    slug: organization.slug,
                                                    package_id: skill.skillPackageId,
                                                    group_id: skill.skillGroup.id,
                                                },
                                            )}
                                        >
                                            {skill.skillGroup.name}
                                        </Link>
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Description</DataItemTitle>
                                    <DataItemValue>{skill.description}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Required</DataItemTitle>
                                    <DataItemValue>
                                        {skill.defaultRequired ? "Yes" : "No"}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Revalidation Frequency</DataItemTitle>
                                    <DataItemValue>
                                        {skill.frequency ? `${skill.frequency} months` : "None"}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
