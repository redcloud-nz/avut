/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/equipment
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { route } from "@/lib/routes";

export default async function D4HModule_Equipment_Page(
    props: PageProps<`/orgs/[slug]/d4h/equipment`>,
) {
    const { slug } = await props.params;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    "Equipment",
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="D4H - Equipment">
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/orgs/[slug]/d4h/equipment/brands", { slug })}>
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
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
