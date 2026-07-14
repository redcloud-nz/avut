/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { ChevronRightIcon } from "lucide-react";

import { Argus } from "@/components/blocks/argus";
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
import { orgModules } from "@/lib/modules";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);
    const { modules } = settings;

    const availableModules = orgModules.filter(
        (mod) => mod.alwaysOn || (mod.id !== "admin" && modules[mod.id].enabled),
    );

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.Header title={organization.name} />
                <Card>
                    <CardHeader>
                        <CardTitle>Available Modules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ItemGroup>
                            {availableModules.map((mod) => {
                                const Icon = mod.icon;

                                return (
                                    <Item key={mod.id} asChild>
                                        <Link href={mod.href(slug)}>
                                            <ItemMedia>
                                                <Icon />
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle>{mod.label}</ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon className="size-4" />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                );
                            })}
                        </ItemGroup>
                    </CardContent>
                </Card>
            </Argus.Column>
        </Argus.Root>
    );
}
