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
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Group_Contents_List } from "./group-contents";
import { SkillPackageBuilder_Group_Menu } from "./group-menu";
import { SkillPackageBuilder_UpdateGroup_Dialog } from "./update-group";

export function SkillPackageBuilder_Group_Content({ groupId }: { groupId: SkillGroupId }) {
    const organization = useOrganization();

    const { data: skillGroup } = useSuspenseQuery(
        trpc.skillPackageBuilder.getGroup.queryOptions({
            organizationId: organization.id,
            skillGroupId: groupId,
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
                        label: skillGroup.skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skillGroup.skillPackageId,
                        }),
                    },
                    "Groups",
                    skillGroup.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title
                            badges={
                                skillGroup.status !== "Active" && (
                                    <Badge variant="outline">{skillGroup.status}</Badge>
                                )
                            }
                        >
                            {skillGroup.name}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillPackageBuilder_Group_Menu skillGroup={skillGroup} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <RecordCard
                                label="Skill Group"
                                updatedAt={skillGroup.updatedAt}
                                historyHref={route(
                                    "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/history",
                                    {
                                        slug: organization.slug,
                                        package_id: skillGroup.skillPackageId,
                                        group_id: skillGroup.id,
                                    },
                                )}
                                action={
                                    <Protect permissions={{ skillPackage: ["update"] }}>
                                        <SkillPackageBuilder_UpdateGroup_Dialog
                                            skillGroup={skillGroup}
                                        />
                                    </Protect>
                                }
                            >
                                <CardContent>
                                    <DataList>
                                        <RecordCardId label="Group ID" id={skillGroup.id} />
                                        <DataItem>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{skillGroup.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Package</DataItemTitle>
                                            <DataItemValue>
                                                <Link
                                                    href={route(
                                                        "/orgs/[slug]/skill-package-builder/packages/[package_id]",
                                                        {
                                                            slug: organization.slug,
                                                            package_id: skillGroup.skillPackageId,
                                                        },
                                                    )}
                                                >
                                                    {skillGroup.skillPackage.name}
                                                </Link>
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Description</DataItemTitle>
                                            <DataItemValue>
                                                {skillGroup.description ?? "-"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </RecordCard>
                            <SkillPackageBuilder_Group_Contents_List
                                skillGroup={skillGroup}
                                skillPackage={skillGroup.skillPackage}
                            />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
