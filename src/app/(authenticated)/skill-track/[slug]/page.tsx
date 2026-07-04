/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /skill-track/[slug]
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
import { getOrganizationBySlug } from "@/server/organization";

export default async function SkillTrack_Index_Page(props: PageProps<`/skill-track/[slug]`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/skill-track/[slug]", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="Skill Track">
                    <ItemGroup>
                        <Protect
                            orgId={organization.id}
                            permissions={{ skillPackageSubscription: ["view"] }}
                        >
                            <Item asChild>
                                <Link href={route("/skill-track/[slug]/catalogue", { slug })}>
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
                        <Protect orgId={organization.id} permissions={{ skillCheck: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/skill-track/[slug]/checks", { slug })}>
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
                        <Protect
                            orgId={organization.id}
                            permissions={{ skillCheckSession: ["view"] }}
                        >
                            <Item asChild>
                                <Link href={route("/skill-track/[slug]/sessions", { slug })}>
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
                        <Protect orgId={organization.id} permissions={{ skillCheck: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/skill-track/[slug]/reports", { slug })}>
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
