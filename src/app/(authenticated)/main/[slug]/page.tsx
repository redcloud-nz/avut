/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import { Show } from "@/components/show";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export const metadata = { title: "Organisation Dashboard" };

export default async function MainApp_Index_Page(
    props: PageProps<`/main/[slug]`>,
) {
    const { slug } = await props.params;

    const organization = await getOrganizationBySlug(slug);
    const { modules } = await getOrganizationSettings(organization.id);
    const t = await getTranslations("MainApp");

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[t("Index_Page.title")]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4">
                        <AVUTLogo />
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link href={`/main/${slug}/admin`}>
                                <ItemContent>
                                    <ItemTitle>
                                        {t("AdminModule.title")}
                                    </ItemTitle>
                                    <ItemDescription>
                                        {t("AdminModule.description")}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={`/main/${slug}/d4h-views`}>
                                <ItemContent>
                                    <ItemTitle>
                                        {t("D4HViewsModule.title")}
                                    </ItemTitle>
                                    <ItemDescription>
                                        {t("D4HViewsModule.description")}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={`/main/${slug}/i3`}>
                                <ItemContent>
                                    <ItemTitle>{t("I3Module.title")}</ItemTitle>
                                    <ItemDescription>
                                        {t("I3Module.description")}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Show when={modules.notes.enabled}>
                            <Item asChild>
                                <Link href={`/main/${slug}/notes`}>
                                    <ItemContent>
                                        <ItemTitle>
                                            {t("NotesModule.title")}
                                        </ItemTitle>
                                        <ItemDescription>
                                            {t("NotesModule.description")}
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
                                <Link
                                    href={`/main/${slug}/skill-package-builder`}
                                >
                                    <ItemContent>
                                        <ItemTitle>
                                            {t(
                                                "SkillPackageBuilderModule.title",
                                            )}
                                        </ItemTitle>
                                        <ItemDescription>
                                            {t(
                                                "SkillPackageBuilderModule.description",
                                            )}
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
                                <Link href={`/main/${slug}/skills`}>
                                    <ItemContent>
                                        <ItemTitle>
                                            {t("SkillsModule.title")}
                                        </ItemTitle>
                                        <ItemDescription>
                                            {t("SkillsModule.description")}
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
