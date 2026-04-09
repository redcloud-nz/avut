/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/admin
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import { Protect } from "@/components/protect";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

export default async function AdminIndex_Page(props: PageProps<`/main/[slug]/admin`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["Admin"]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">Admin Module</div>
                    </div>
                    <ItemGroup>
                        <Protect permissions={{ d4hAccessToken: ["view"] }} orgId={organization.id}>
                            <Item asChild>
                                <Link
                                    href={route("/main/[slug]/admin/d4h-access-tokens", { slug })}
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
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ invitation: ["view"] }}>
                            <Item asChild>
                                <Link href={route("/main/[slug]/admin/invitations", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Invitations</ItemTitle>
                                        <ItemDescription>
                                            Manage invitations to your organisation.
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
                                <Link href={route("/main/[slug]/admin/organization", { slug })}>
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
                                <Link href={route("/main/[slug]/admin/personnel", { slug })}>
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
                        <Protect orgId={organization.id} permissions={{ organization: ["update"] }}>
                            <Item asChild>
                                <Link
                                    href={route("/main/[slug]/admin/organization/settings", {
                                        slug,
                                    })}
                                >
                                    <ItemContent>
                                        <ItemTitle>Settings</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's settings.
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
                                <Link href={route("/main/[slug]/admin/teams", { slug })}>
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
                                <Link href={route("/main/[slug]/admin/users", { slug })}>
                                    <ItemContent>
                                        <ItemTitle>Users</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's users and their roles.
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
