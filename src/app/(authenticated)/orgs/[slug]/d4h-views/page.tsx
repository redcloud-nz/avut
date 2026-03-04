/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views
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

export default async function D4HViews_Index_Page(
    props: PageProps<`/orgs/[slug]/d4h-views`>,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[Paths.org(slug).d4hViews.index]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">D4H Views Module</div>
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link to={Paths.org(slug).d4hViews.equipment.index}>
                                <ItemContent>
                                    <ItemTitle>Equipment</ItemTitle>
                                    <ItemDescription>
                                        View your D4H equipment.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link to={Paths.org(slug).d4hViews.personnel}>
                                <ItemContent>
                                    <ItemTitle>Personnel</ItemTitle>
                                    <ItemDescription>
                                        View your d4h personnel data.
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
