/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /skill-track/[slug]/reports
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

export default async function SkillsTrack_Reports_Page(
    props: PageProps<`/skill-track/[slug]/reports`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/skill-track/[slug]", { slug }) },
                    { label: "Reports", href: route("/skill-track/[slug]/reports", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="Skills Reports">
                    <ItemGroup></ItemGroup>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
