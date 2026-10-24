/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { route } from "@/lib/routes";

export default async function D4H_Index_Page(props: PageProps<`/orgs/[slug]/d4h`>) {
    const { slug } = await props.params;

    return (
        <>
            <Std.Navbar breadcrumbs={["D4H"]} actions={<HelpButton id="d4h" />} />
            <Std.ScrollContainer>
                <Std.IndexPage title="D4H">
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h/teams", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Teams</ItemTitle>
                                    <ItemDescription>View your D4H teams.</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h/equipment", { slug })}>
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
                            <Link href={route("/orgs/[slug]/d4h/members", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Members</ItemTitle>
                                    <ItemDescription>View your D4H members.</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h/categories", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Categories</ItemTitle>
                                    <ItemDescription>
                                        View your D4H equipment categories.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h/types", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Types</ItemTitle>
                                    <ItemDescription>
                                        View your D4H equipment types.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
