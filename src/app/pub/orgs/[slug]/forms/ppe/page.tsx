/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";
import { ChevronRightIcon } from "lucide-react";

export async function generateStaticParams() {
    return [{ slug: "christchurch-em" }];
}

export const metadata = {
    title: `PPE`,
};

export default async function Pub_PPEIndex_Page(
    props: PageProps<"/pub/orgs/[slug]/forms/ppe">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.pub(slug).forms.index,
                    Paths.pub(slug).forms.ppe,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.SectionTitle>PPE Forms</Hermes.SectionTitle>
                        </Hermes.SectionHeader>
                        <div className="flex flex-col gap-4 mt-4">
                            <Item asChild variant="outline">
                                <Link to={Paths.pub(slug).forms.ppe.borrow}>
                                    <ItemContent>
                                        <ItemTitle>Borrow PPE</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                            <Item asChild variant="outline">
                                <Link to={Paths.pub(slug).forms.ppe.issue}>
                                    <ItemContent>
                                        <ItemTitle>Issue PPE</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                            <Item asChild variant="outline">
                                <Link to={Paths.pub(slug).forms.ppe.return}>
                                    <ItemContent>
                                        <ItemTitle>Return PPE</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </div>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
