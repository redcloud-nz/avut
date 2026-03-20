/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
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

export async function generateStaticParams() {
    return [{ slug: "christchurch-em" }];
}

export const metadata = {
    title: `PPE`,
};

export default async function Pub_PPEIndex_Page(props: PageProps<"/pub/orgs/[slug]/forms/ppe">) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.pub(slug).forms.index, Paths.pub(slug).forms.ppe]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.Title>PPE Forms</Hermes.Title>
                        </Hermes.Header>
                        <div className="flex flex-col gap-4 mt-4">
                            <ItemGroup>
                                <Item asChild>
                                    <Link to={Paths.pub(slug).forms.ppe.borrow}>
                                        <ItemContent>
                                            <ItemTitle>Borrow PPE</ItemTitle>
                                            <ItemDescription>
                                                Record temporarily borrowing PPE.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                                <Item asChild>
                                    <Link to={Paths.pub(slug).forms.ppe.inspect}>
                                        <ItemContent>
                                            <ItemTitle>Inspect PPE</ItemTitle>
                                            <ItemDescription>
                                                Record an inspection of the PPE items that have been
                                                issued to an individual.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                                <Item asChild>
                                    <Link to={Paths.pub(slug).forms.ppe.issue}>
                                        <ItemContent>
                                            <ItemTitle>Issue PPE</ItemTitle>
                                            <ItemDescription>
                                                Record issuing PPE to an individual.
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                                <Item asChild>
                                    <Link to={Paths.pub(slug).forms.ppe.return}>
                                        <ItemContent>
                                            <ItemTitle>Return PPE</ItemTitle>
                                            <ItemDescription>
                                                Record returning previously issued PPE items.
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
