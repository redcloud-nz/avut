/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /i3/[slug]
 */

import { ChevronRightIcon } from "lucide-react";

import { Hermes } from "@/components/blocks/hermes";
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

export default async function I3_Index_Page(props: PageProps<"/i3/[slug]">) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[Paths.i3(slug).index]} />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.Title>
                                AVUT <span className="ml-1">I3</span>
                            </Hermes.Title>
                            <Hermes.Description>
                                Items Issued to Individuals
                            </Hermes.Description>
                        </Hermes.Header>
                        <div className="flex flex-col gap-4 mt-4">
                            <ItemGroup>
                                {/* <Item asChild>
                                    <Link to={Paths.i3(slug).borrow}>
                                        <ItemContent>
                                            <ItemTitle>Borrow PPE</ItemTitle>
                                            <ItemDescription>
                                                Record temporarily borrowing
                                                PPE.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item> */}
                                <Item asChild>
                                    <Link to={Paths.i3(slug).inspect}>
                                        <ItemContent>
                                            <ItemTitle>Inspect Items</ItemTitle>
                                            <ItemDescription>
                                                Record an inspection of the
                                                items that have been issued to
                                                an individual.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                                <Item asChild>
                                    <Link to={Paths.i3(slug).issue}>
                                        <ItemContent>
                                            <ItemTitle>Issue Items</ItemTitle>
                                            <ItemDescription>
                                                Record items being issued to an
                                                individual.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                                <Item asChild>
                                    <Link to={Paths.i3(slug).return}>
                                        <ItemContent>
                                            <ItemTitle>Return Items</ItemTitle>
                                            <ItemDescription>
                                                Record items being returned from
                                                an individual.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            </ItemGroup>
                        </div>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
