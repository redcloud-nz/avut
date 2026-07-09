/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { ChevronRightIcon } from "lucide-react";

import { Argus } from "@/components/blocks/argus";
import { ModuleIcons } from "@/components/icons";
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

export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
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
                                <Link href={route("/orgs/[slug]/skill-track", { slug })}>
                                    <ItemMedia>
                                        <ModuleIcons.Skills />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>Skill Track</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </ItemGroup>
                    </CardContent>
                </Card>
            </Argus.Column>
        </Argus.Root>
    );
}
