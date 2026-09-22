/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { orgModules } from "@/lib/modules";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { getOrganizationSettings } from "@/server/cache/organization-settings";
import { resolveModuleFlags } from "@/server/module-flags";

export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);
    const { modules } = settings;
    const moduleFlags = await resolveModuleFlags();

    const availableModules = orgModules.filter(
        (mod) =>
            moduleFlags[mod.id] !== false &&
            (mod.alwaysOn || (mod.id !== "org-admin" && modules[mod.id].enabled)),
    );

    return (
        <>
            <Std.Navbar breadcrumbs={[organization.name]} />
            <Std.ScrollContainer>
                <Std.IndexPage title={organization.name}>
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
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
