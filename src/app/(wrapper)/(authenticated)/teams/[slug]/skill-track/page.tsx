/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track
 */

import { ChevronRightIcon } from "lucide-react";
import { Metadata } from "next";
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

// The team layout's title template adds the team's name.
export const metadata: Metadata = { title: "Skill Track" };

export default async function Team_SkillTrack_Index_Page(
    props: PageProps<`/teams/[slug]/skill-track`>,
) {
    const { slug } = await props.params;
    return (
        <>
            <Std.ScrollContainer>
                <Std.IndexPage title="Skill Track">
                    <ItemGroup>
                        <Protect permissions={{ skillPackageSubscription: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/teams/[slug]/skill-track/packages", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Packages</ItemTitle>
                                        <ItemDescription>
                                            Browse and subscribe to skill packages.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ skillPackageSubscription: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/teams/[slug]/skill-track/skills", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skills</ItemTitle>
                                        <ItemDescription>
                                            Every skill in the packages you subscribe to.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ skillCheck: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/teams/[slug]/skill-track/checks", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Checks</ItemTitle>
                                        <ItemDescription>
                                            Search skill checks and their results.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ skillCheckSession: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/teams/[slug]/skill-track/sessions", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Sessions</ItemTitle>
                                        <ItemDescription>
                                            View and manage skill check sessions.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ skillCheck: ["view"] }}>
                            <Item variant="outline" asChild>
                                <Link href={route("/teams/[slug]/skill-track/reports", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Reports</ItemTitle>
                                        <ItemDescription>
                                            Generate reports on skill check performance.
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
