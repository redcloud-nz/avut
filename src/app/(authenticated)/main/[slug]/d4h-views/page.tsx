/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views
 */

import { ChevronRightIcon } from "lucide-react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import Link from "next/link";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import { route } from "@/lib/routes";

export default async function D4HViews_Index_Page(props: PageProps<`/main/[slug]/d4h-views`>) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["D4H Views"]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">D4H Views Module</div>
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/main/[slug]/d4h-views/equipment", { slug })}>
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
                            <Link href={route("/main/[slug]/d4h-views/members", { slug })}>
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
