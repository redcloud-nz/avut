/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
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

export default async function I3_Index_Page(props: PageProps<`/main/[slug]/i3`>) {
    const { slug } = await props.params;

    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={[{ href: route("/main/[slug]/i3", { slug }), label: "I3" }]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="I3 Module">
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/main/[slug]/i3/equipment-kinds", { slug })}>
                                <ItemContent>
                                    <ItemTitle>By Equipment Type</ItemTitle>
                                    <ItemDescription>
                                        View and edit items by their equipment type.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/main/[slug]/i3/members", { slug })}>
                                <ItemContent>
                                    <ItemTitle>By Member</ItemTitle>
                                    <ItemDescription>
                                        View and edit items by their assigned member.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/main/[slug]/i3/forms/issue-items", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Issue Items</ItemTitle>
                                    <ItemDescription>
                                        Record items being issued to members
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/main/[slug]/i3/forms/return-items", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Return Items</ItemTitle>
                                    <ItemDescription>
                                        Record items being returned by members
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Protect orgId={organization.id} permissions={{ i3Template: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/i3/templates", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Templates</ItemTitle>
                                        <ItemDescription>
                                            View and manage I3 templates
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
