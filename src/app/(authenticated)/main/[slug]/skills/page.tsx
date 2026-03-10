/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills
 */

import { ChevronRightIcon } from "lucide-react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import { Protect } from "@/components/protect";
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

export default async function SkillsIndex_Page(
    props: PageProps<`/main/[slug]/skills`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[Paths.main(slug).skills.index]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">Skills Module</div>
                    </div>
                    <ItemGroup>
                        <Protect
                            orgId={organization.id}
                            permissions={{ skills: ["view"] }}
                        >
                            <Item asChild>
                                <Link to={Paths.main(slug).skills.catalogue}>
                                    <ItemContent>
                                        <ItemTitle>Skill Catalogue</ItemTitle>
                                        <ItemDescription>
                                            Browse and subscribe to skill
                                            packages.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
