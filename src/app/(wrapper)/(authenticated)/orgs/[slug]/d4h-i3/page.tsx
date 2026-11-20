/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { route } from "@/lib/routes";

export default async function D4HI3_Index_Page(props: PageProps<`/orgs/[slug]/d4h-i3`>) {
    const { slug } = await props.params;

    return (
        <>
            <Std.ScrollContainer>
                <Std.IndexPage title="D4H I3">
                    <ItemGroup>
                        <Protect permissions={{ i3Item: ["issue"] }}>
                            <Item variant="outline" asChild>
                                <Link
                                    href={route("/orgs/[slug]/d4h-i3/forms/issue-items", { slug })}
                                >
                                    <ItemContent>
                                        <ItemTitle>Issue Items</ItemTitle>
                                        <ItemDescription>
                                            Record items being issued to members
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ i3Item: ["return"] }}>
                            <Item variant="outline" asChild>
                                <Link
                                    href={route("/orgs/[slug]/d4h-i3/forms/return-items", { slug })}
                                >
                                    <ItemContent>
                                        <ItemTitle>Return Items</ItemTitle>
                                        <ItemDescription>
                                            Record items being returned by members
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ i3Item: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/orgs/[slug]/d4h-i3/issued-types", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Issued Types</ItemTitle>
                                        <ItemDescription>
                                            See which equipment types are issued to a team&apos;s
                                            members, and who holds what
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ i3Bundle: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/orgs/[slug]/d4h-i3/bundles", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Bundles</ItemTitle>
                                        <ItemDescription>
                                            Standard-issue kit lists, and who holds or is missing
                                            each item
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ i3Template: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/orgs/[slug]/d4h-i3/templates", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Templates</ItemTitle>
                                        <ItemDescription>
                                            View and manage D4H I3 templates
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
