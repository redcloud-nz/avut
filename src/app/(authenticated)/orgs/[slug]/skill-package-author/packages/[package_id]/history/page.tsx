/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-author/packages/[package_id]/history
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { NotImplemented } from "@/components/nav/errors";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function SkillPackageAuthor_SkillPackageHistory_Page(
    props: PageProps<`/orgs/[slug]/skill-package-author/packages/[package_id]/history`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skills.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId: package_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageAuthor.index,
                    Paths.org(slug).skillPackageAuthor.skillPackages,
                    {
                        href: Paths.org(slug).skillPackageAuthor.skillPackage(
                            package_id,
                        ).href,
                        label: skillPackage.name,
                    },
                    "History",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column
                    width="lg"
                    className="h-full flex flex-col justify-center"
                >
                    <NotImplemented />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
