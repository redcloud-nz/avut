/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views
 */

import { ChevronRightIcon } from "lucide-react";
import { Route } from "next";
import Link from "next/link";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import * as Paths from "@/paths";
import { getTranslations } from "next-intl/server";
import { Protect } from "@/components/protect";
import { getOrganizationBySlug } from "@/server/organization";

export default async function I3_Index_Page(props: PageProps<`/main/[slug]/i3`>) {
    const { slug } = await props.params;

    const organization = await getOrganizationBySlug(slug);
    const t = await getTranslations("I3Module");

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={[Paths.main(slug).i3.index]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">I3 Module</div>
                    </div>
                    <ItemGroup>
                        {/* <Item asChild>
                            <Link href={`/main/${slug}/i3/forms/inspect` as Route}>
                                <ItemContent>
                                    <ItemTitle>{t("inspect")}</ItemTitle>
                                    <ItemDescription>{t("inspectDescription")}</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item> */}
                        <Item asChild>
                            <Link href={`/main/${slug}/i3/forms/issue-items` as Route}>
                                <ItemContent>
                                    <ItemTitle>{t("issue")}</ItemTitle>
                                    <ItemDescription>{t("issueDescription")}</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link href={`/main/${slug}/i3/forms/return` as Route}>
                                <ItemContent>
                                    <ItemTitle>{t("return")}</ItemTitle>
                                    <ItemDescription>{t("returnDescription")}</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Protect orgId={organization.id} permissions={{ i3Template: ["view"] }}>
                            <Item asChild>
                                <Link href={`/main/${slug}/i3/templates`}>
                                    <ItemContent>
                                        <ItemTitle>{t("templates")}</ItemTitle>
                                        <ItemDescription>
                                            {t("templatesDescription")}
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
