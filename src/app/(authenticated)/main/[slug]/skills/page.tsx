/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills
 */

import { ChevronRightIcon } from "lucide-react";

import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import Link from "next/link";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

export default async function SkillsIndex_Page(props: PageProps<`/main/[slug]/skills`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[{ label: "Skills", href: route("/main/[slug]/skills", { slug }) }]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="Skills Module">
                    <ItemGroup>
                        <Protect orgId={organization.id} permissions={{ skills: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/skills/catalogue", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skill Catalogue</ItemTitle>
                                        <ItemDescription>
                                            Browse and subscribe to skill packages.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
