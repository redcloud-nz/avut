/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports
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

export default async function SkillsTrack_Reports_Page(
    props: PageProps<`/orgs/[slug]/skill-track/reports`>,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skills", href: route("/orgs/[slug]/skill-track", { slug }) },
                    { label: "Reports", href: route("/orgs/[slug]/skill-track/reports", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="Skills Reports">
                    <ItemGroup>
                        <Protect orgId={organization.id} permissions={{ skillCheck: ["view"] }}>
                            <Item asChild>
                                <Link
                                    href={route("/orgs/[slug]/skill-track/reports/person", {
                                        slug,
                                    })}
                                >
                                    <ItemContent>
                                        <ItemTitle>Personnel Competency</ItemTitle>
                                        <ItemDescription>
                                            Competency and currency for an individual person.
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
