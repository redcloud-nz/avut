/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/--create
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import { and, eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import * as Paths from "@/paths";

import { SkillPackageBuilder_CreateSkill_Form } from "./create-skill";

export default function SkillPackageBuilder_CreateSkill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/--create`>,
) {
    const { slug, package_id } = use(props.params);
    const searchParams = useSearchParams();

    const groupId = searchParams.get("groupId");
    const organization = useOrganization();

    const { data: skillPackage } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: getSkillPackagesCollection(organization.id) })
            .where(({ skillPackage }) => eq(skillPackage.id, package_id))
            .findOne(),
    );
    const { data: skillGroup } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillGroup: getSkillGroupsCollection(organization.id) })
            .where(({ skillGroup }) =>
                and(
                    eq(skillGroup.id, groupId ?? "NEVER"),
                    eq(skillGroup.skillPackageId, package_id),
                ),
            )
            .findOne(),
    );

    if (!skillPackage)
        throw new Error(`Skill Package (${package_id}) not found`);

    if (groupId && !skillGroup)
        throw new Error(`Skill Group (${groupId}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    {
                        ...Paths.org(slug).skillPackageBuilder.skillPackage(
                            package_id,
                        ).index,
                        label: skillPackage.name,
                    },
                    "Skills",
                    "Create",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            {skillGroup ? (
                                <Hermes.BackButton
                                    to={Paths.org(slug)
                                        .skillPackageBuilder.skillPackage(
                                            package_id,
                                        )
                                        .group(skillGroup.id)}
                                >
                                    Group
                                </Hermes.BackButton>
                            ) : (
                                <Hermes.BackButton
                                    to={
                                        Paths.org(
                                            slug,
                                        ).skillPackageBuilder.skillPackage(
                                            package_id,
                                        ).index
                                    }
                                >
                                    Package
                                </Hermes.BackButton>
                            )}
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_CreateSkill_Form
                            skillPackage={skillPackage}
                            skillGroup={skillGroup ?? null}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
