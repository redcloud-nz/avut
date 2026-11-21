/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { RecordStatusBadge, SkillPackagePublishBadge } from "@/components/ui/status-badge";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Package_Contents_List } from "./package-contents";
import { SkillPackageBuilder_Package_Menu } from "./package-menu";
import { SkillPackageBuilder_UpdatePackage_Dialog } from "./update-package";

export function SkillPackageBuilder_Package_Content({
    skillPackageId,
}: {
    skillPackageId: SkillPackageId;
}) {
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skillPackageBuilder.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title
                    badges={
                        <>
                            <RecordStatusBadge status={skillPackage.status} />
                            <SkillPackagePublishBadge published={skillPackage.published} />
                        </>
                    }
                >
                    {skillPackage.name}
                </Saratoga.Title>
                <Saratoga.Actions>
                    <SkillPackageBuilder_Package_Menu skillPackage={skillPackage} />
                </Saratoga.Actions>
            </Saratoga.Header>
            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard
                        label="Skill Package"
                        updatedAt={skillPackage.updatedAt}
                        historyHref={route(
                            "/orgs/[slug]/skill-package-builder/packages/[package_id]/history",
                            { slug: organization.slug, package_id: skillPackage.id },
                        )}
                        action={
                            <Protect permissions={{ skillPackage: ["update"] }}>
                                <SkillPackageBuilder_UpdatePackage_Dialog
                                    skillPackage={skillPackage}
                                />
                            </Protect>
                        }
                    >
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
                            </DataList>
                        </CardContent>
                    </RecordCard>
                    <SkillPackageBuilder_Package_Contents_List skillPackage={skillPackage} />
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
