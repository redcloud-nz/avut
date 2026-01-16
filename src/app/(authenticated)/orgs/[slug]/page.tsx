/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { ChevronRightIcon } from "lucide-react";

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
import { Link } from "@/components/ui/link";

import { d4hViewsModuleFlag, notesModuleFlag } from "@/lib/flags";
import { isModuleEnabled } from "@/lib/modules";
import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";

export const metadata = { title: "Organisation Dashboard" };

export default async function OrganizationDashboard_Page(
    props: PageProps<`/orgs/[slug]`>,
) {
    const { slug } = await props.params;

    const [organization, notesModuleAllowed, d4hViewsModuleAllowed] =
        await Promise.all([
            getOrganizationBySlug(slug),
            notesModuleFlag(),
            d4hViewsModuleFlag(),
        ]);

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["Dashboard"]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4">
                        <AVUTLogo />
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link to={Paths.org(slug).admin.index}>
                                <ItemContent>
                                    <ItemTitle>Admin</ItemTitle>
                                    <ItemDescription>
                                        Manage personnel, teams, and
                                        organization settings.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Show
                            when={
                                notesModuleAllowed &&
                                isModuleEnabled(organization, "notes")
                            }
                        >
                            <Item asChild>
                                <Link to={Paths.org(slug).notes.index}>
                                    <ItemContent>
                                        <ItemTitle>Notes</ItemTitle>
                                        <ItemDescription>
                                            Create and manage organizational
                                            notes.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                        <Show when={isModuleEnabled(organization, "d4h-views")}>
                            <Item asChild>
                                <Link to={Paths.org(slug).d4hViews.index}>
                                    <ItemContent>
                                        <ItemTitle>D4H Views</ItemTitle>
                                        <ItemDescription>
                                            Alternate views of the data stored
                                            in D4H Team Manager.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                        <Show
                            when={isModuleEnabled(
                                organization,
                                "skill-package-manager",
                            )}
                        >
                            <Item asChild>
                                <Link
                                    to={
                                        Paths.org(slug).skillPackageManager
                                            .index
                                    }
                                >
                                    <ItemContent>
                                        <ItemTitle>
                                            Skill Package Manager
                                        </ItemTitle>
                                        <ItemDescription>
                                            Create, edit, and manage skill
                                            packages.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Show>
                        <Show when={isModuleEnabled(organization, "skills")}>
                            <Item asChild>
                                <Link to={Paths.org(slug).skills.index}>
                                    <ItemContent>
                                        <ItemTitle>Skills</ItemTitle>
                                        <ItemDescription>
                                            Manage, assess, and report skills
                                            for your team.
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
