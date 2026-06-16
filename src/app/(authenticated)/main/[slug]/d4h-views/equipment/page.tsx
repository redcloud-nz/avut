/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment
 */

import { ChevronRightIcon } from "lucide-react";

import { Std } from "@/components/blocks/std";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import Link from "next/link";

import { route } from "@/lib/routes";

export default async function D4HViewsModule_Equipment_Page(
    props: PageProps<`/main/[slug]/d4h-views/equipment`>,
) {
    const { slug } = await props.params;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H Views", href: route("/main/[slug]/d4h-views", { slug }) },
                    "Equipment",
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="D4H Views Module - Equipment">
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/main/[slug]/d4h-views/equipment/brands", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Equipment Brands</ItemTitle>
                                    <ItemDescription>
                                        View your D4H equipment brands.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/d4h-views/equipment/categories", {
                                    slug,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>Equipment Categories</ItemTitle>
                                    <ItemDescription>
                                        View your D4H equipment categories.
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
        </Std.SidebarInset>
    );
}
