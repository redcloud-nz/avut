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
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { trpc } from "@/trpc/client";

import { packageBreadcrumbs } from "../lib/breadcrumbs";

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
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    ...packageBreadcrumbs(
                        organization.slug,
                        { id: skillGroup.skillPackageId, name: skillGroup.skillPackage.name },
                        "Groups",
                    ),
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title badges={<RecordStatusBadge status={skillGroup.status} />}>
                    {skillGroup.name}
                </Saratoga.Title>
            </Saratoga.Header>
            {/* Nothing for a secondary column: full width. */}
            <div className="space-y-4">
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
                        <>
                            <Protect permissions={{ skillPackage: ["update"] }}>
                                <SkillPackageBuilder_UpdateGroup_Dialog
                                    skillGroup={skillGroup}
                                    primary
                                />
                            </Protect>
                            <SkillPackageBuilder_Group_Menu skillGroup={skillGroup} />
                        </>
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
                                <DataItemValue>{skillGroup.description ?? "-"}</DataItemValue>
                            </DataItem>
                        </DataList>
                    </CardContent>
                </RecordCard>
                <SkillPackageBuilder_Group_Contents_List
                    skillGroup={skillGroup}
                    skillPackage={skillGroup.skillPackage}
                />
            </div>
        </Saratoga.Root>
    );
}
