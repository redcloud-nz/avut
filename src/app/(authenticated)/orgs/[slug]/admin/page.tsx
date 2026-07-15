/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
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

export default async function AdminIndex_Page(props: PageProps<`/orgs/[slug]/admin`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Admin"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="Admin Module">
                    <ItemGroup>
                        {/* <Protect permissions={{ d4hAccessToken: ["view"] }} orgId={organization.id}>
                            <Item asChild>
                                <Link
                                    href={route("/orgs/[slug]/admin/d4h-access-tokens", { slug })}
                                >
                                    <ItemContent>
                                        <ItemTitle>D4H Access Tokens</ItemTitle>
                                        <ItemDescription>
                                            Manage the shared D4H access tokens for your
                                            organisation.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect> */}
                        <Protect orgId={organization.id} permissions={{ invitation: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/admin/invitations", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Invitations</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's invitations.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ organization: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/admin/organization", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Organization</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's details.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>

                        <Protect orgId={organization.id} permissions={{ person: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/admin/personnel", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Personnel</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's personnel.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ team: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/admin/teams", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Teams</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's teams.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ member: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/orgs/[slug]/admin/users", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Users</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's users.
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
