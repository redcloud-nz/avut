/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { ChevronRightIcon } from "lucide-react";

import { Argus } from "@/components/blocks/argus";
import { ModuleIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import Link from "next/link";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);
    const { modules } = settings;

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.Header title={organization.name} />
                <Card>
                    <CardHeader>
                        <CardTitle>Available Apps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ItemGroup>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/admin", { slug })}>
                                    <ItemMedia>
                                        <ModuleIcons.Admin />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>Admin</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                            <Show when={modules["d4h-views"].enabled}>
                                <Item asChild>
                                    <Link href={route("/orgs/[slug]/d4h-views", { slug })}>
                                        <ItemMedia>
                                            <ModuleIcons.D4HViews />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>D4H Views</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            </Show>
                            <Show when={modules.i3.enabled}>
                                <Item asChild>
                                    <Link href={route("/orgs/[slug]/i3", { slug })}>
                                        <ItemMedia>
                                            <ModuleIcons.I3 />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>I3</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            </Show>
                            <Show when={modules.skills.enabled}>
                                <Item asChild>
                                    <Link href={route("/orgs/[slug]/skill-track", { slug })}>
                                        <ItemMedia>
                                            <ModuleIcons.SkillTrack />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>Skill Track</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            </Show>
                            <Show when={modules["skill-package-builder"].enabled}>
                                <Item asChild>
                                    <Link
                                        href={route("/orgs/[slug]/skill-package-builder", { slug })}
                                    >
                                        <ItemMedia>
                                            <ModuleIcons.SkillPackageBuilder />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>Skill Package Builder</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            </Show>
                        </ItemGroup>
                    </CardContent>
                </Card>
            </Argus.Column>
        </Argus.Root>
    );
}
