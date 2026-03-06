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

export default async function D4HPPE_Index_Page(
    props: PageProps<`/orgs/[slug]/d4h-ppe`>,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[Paths.org(slug).d4HPpe.index]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">D4H PPE Module</div>
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link to={Paths.org(slug).d4HPpe.templates}>
                                <ItemContent>
                                    <ItemTitle>Templates</ItemTitle>
                                    <ItemDescription>
                                        Manage PPE item templates.
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
