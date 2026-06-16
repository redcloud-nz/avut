/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import { Show } from "@/components/show";
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
import { getOrganizationSettings } from "@/server/organization-settings";

export const metadata = { title: "Organisation Dashboard" };

export default async function MainApp_Index_Page(props: PageProps<`/main/[slug]`>) {
    const { slug } = await props.params;

    const organization = await getOrganizationBySlug(slug);
    const { modules } = await getOrganizationSettings(organization.id);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Dashboard"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="Dashboard">
                    <ItemGroup>
                        <Item asChild>
                            <Link href={route("/main/[slug]/admin", { slug })}>
                                <ItemContent>
                                    <ItemTitle>Admin Module</ItemTitle>
                                    <ItemDescription>
                                        Manage administrative tasks and settings
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Show when={modules["d4h-views"].enabled}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/d4h-views", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>D4H Views Module</ItemTitle>
                                        <ItemDescription>View and manage D4H data</ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                        <Show when={modules.i3.enabled}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/i3", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>I3</ItemTitle>
                                        <ItemDescription>
                                            Manange individually issued items.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>

                        <Show when={modules.notes.enabled}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/notes", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Notes</ItemTitle>
                                        <ItemDescription>
                                            Manage notes and related tasks.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                        <Show when={modules["skill-package-builder"].enabled}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/skill-package-builder", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skill Package Builder</ItemTitle>
                                        <ItemDescription>
                                            Manage skill packages and related tasks.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                        <Show when={modules.skills.enabled}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/skills", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Skills</ItemTitle>
                                        <ItemDescription>
                                            Manage skills and record skill-checks.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                    </ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
