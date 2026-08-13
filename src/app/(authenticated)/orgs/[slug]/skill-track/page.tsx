/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track
 */

import { ChevronRightIcon } from "lucide-react";

import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import Link from "next/link";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";

import { route } from "@/lib/routes";
import { requireOrganization } from "@/server/organization-access";

export default async function SkillTrack_Index_Page(props: PageProps<`/orgs/[slug]/skill-track`>) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="Skill Track">
                    <ItemGroup>
                        <Protect permissions={{ skillPackageSubscription: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/skill-track/catalogue", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skill Catalogue</ItemTitle>
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
                        <Protect permissions={{ skillCheck: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/skill-track/checks", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skill Checks</ItemTitle>
                                        <ItemDescription>
                                            View recent skill checks and their results.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect permissions={{ skillCheckSession: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/skill-track/sessions", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skill Check Sessions</ItemTitle>
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
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/skill-track/reports", { slug })}>
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
        </Std.SidebarInset>
    );
}
