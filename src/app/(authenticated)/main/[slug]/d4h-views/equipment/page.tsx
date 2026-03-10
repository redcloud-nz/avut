/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment
 */

"use client";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";
import { ChevronRightIcon } from "lucide-react";

export default async function D4HViewsModule_Equipment_Page(
    props: PageProps<`/main/[slug]/d4h-views/equipment`>,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[Paths.main(slug).d4HViews.index]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">
                            D4H Views Module - Equipment
                        </div>
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link
                                to={Paths.main(slug).d4HViews.equipment.brands}
                            >
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
                                to={
                                    Paths.main(slug).d4HViews.equipment
                                        .categories
                                }
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
