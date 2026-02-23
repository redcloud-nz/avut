/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-package-builder
 */

import { ChevronRightIcon } from "lucide-react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import { Link } from "@/components/ui/link";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export default async function SkillPackageBuilder_Index_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.org(slug).skillPackageBuilder.index]}
            />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">
                            Skill Package Builder Module
                        </div>
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link
                                to={
                                    Paths.org(slug).skillPackageBuilder
                                        .skillPackages
                                }
                            >
                                <ItemContent>
                                    <ItemTitle>Skill Packages</ItemTitle>
                                    <ItemDescription>
                                        Manage skill packages
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
