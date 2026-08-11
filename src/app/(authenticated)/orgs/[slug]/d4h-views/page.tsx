/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views
 */

import { ChevronRightIcon } from "lucide-react";

import { Std } from "@/components/blocks/std";
import Link from "next/link";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";

import { requireOrganization } from "@/server/organization-access";
import { route } from "@/lib/routes";

export default async function D4HViews_Index_Page(props: PageProps<`/orgs/[slug]/d4h-views`>) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["D4H Views"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="D4H Views Module">
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h-views/equipment", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Equipment</ItemTitle>
                                    <ItemDescription>View your D4H equipment.</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h-views/members", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Members</ItemTitle>
                                    <ItemDescription>View your D4H members.</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
