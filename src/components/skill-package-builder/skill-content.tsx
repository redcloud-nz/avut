/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: skill.skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skill.skillPackageId,
                        }),
                    },
                    "Skills",
                    skill.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skill.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillPackageBuilder_Skill_Menu skill={skill} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skill Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ skillPackage: ["update"] }}>
                                            <SkillPackageBuilder_UpdateSkill_Dialog skill={skill} />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Skill ID</DataItemTitle>
                                            <DataItemValue>{skill.id}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
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
                                        <DataItem inline>
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
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{skill.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Description</DataItemTitle>
                                            <DataItemValue>{skill.description}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Required</DataItemTitle>
                                            <DataItemValue>
                                                {skill.defaultRequired ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Revalidation Frequency</DataItemTitle>
                                            <DataItemValue>
                                                {skill.frequency
                                                    ? `${skill.frequency} months`
                                                    : "None"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>{skill.status}</DataItemValue>
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
