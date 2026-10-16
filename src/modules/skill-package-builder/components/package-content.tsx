/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", {
                            slug: organization.slug,
                        }),
                    },
                    skillPackage.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skillPackage.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillPackageBuilder_Package_Menu skillPackage={skillPackage} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Package Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ skillPackage: ["update"] }}>
                                            <SkillPackageBuilder_UpdatePackage_Dialog
                                                skillPackage={skillPackage}
                                            />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Package ID</DataItemTitle>
                                            <DataItemValue>{skillPackage.id}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{skillPackage.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Description</DataItemTitle>
                                            <DataItemValue>
                                                {skillPackage.description}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>{skillPackage.status}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Published</DataItemTitle>
                                            <DataItemValue>
                                                {skillPackage.published ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                            <SkillPackageBuilder_Package_Contents_List
                                skillPackage={skillPackage}
                            />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={skillPackage.createdAt} />
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Updated</DataItemTitle>
                                            <DataItemDateValue date={skillPackage.updatedAt} />
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
