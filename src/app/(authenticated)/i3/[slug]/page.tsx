/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /i3/[slug]
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { AVUTLogo } from "@/components/art/avut-logo";
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
import { getTranslations } from "next-intl/server";

export default async function I3_Index_Page(props: PageProps<"/i3/[slug]">) {
    const { slug } = await props.params;
    const t = await getTranslations("I3App.IndexPage");

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[{ label: t("title"), href: `/i3/${slug}` }]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <div className="flex flex-col items-center my-4">
                        <AVUTLogo />
                    </div>
                    <Hermes.Header>
                        <Hermes.Title>{t("title")}</Hermes.Title>
                        <Hermes.Description>
                            {t("description")}
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
                                <Link href={`/i3/${slug}/inspect`}>
                                    <ItemContent>
                                        <ItemTitle>Inspect Items</ItemTitle>
                                        <ItemDescription>
                                            Record an inspection of the items
                                            that have been issued to an
                                            individual.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                            <Item asChild>
                                <Link href={`/i3/${slug}/issue`}>
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
                                <Link href={`/i3/${slug}/return`}>
                                    <ItemContent>
                                        <ItemTitle>Return Items</ItemTitle>
                                        <ItemDescription>
                                            Record items being returned from an
                                            individual.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </ItemGroup>
                    </div>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
