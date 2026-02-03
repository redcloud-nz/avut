/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin
 */

import { ChevronRightIcon } from "lucide-react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import { Protect } from "@/components/protect";
import { Link } from "@/components/ui/link";

import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";

export default async function AdminIndex_Page(
    props: PageProps<`/orgs/[slug]/admin`>,
) {
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
                        <Protect
                            orgId={organization.id}
                            permissions={{ invitation: ["view"] }}
                        >
                            <Item asChild>
                                <Link to={Paths.org(slug).admin.invitations}>
                                    <ItemContent>
                                        <ItemTitle>Invitations</ItemTitle>
                                        <ItemDescription>
                                            Manage invitations to your
                                            organisation.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>

                        <Protect
                            orgId={organization.id}
                            permissions={{ person: ["view"] }}
                        >
                            <Item asChild>
                                <Link to={Paths.org(slug).admin.personnel}>
                                    <ItemContent>
                                        <ItemTitle>Personnel</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's
                                            personnel.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                        <Protect
                            orgId={organization.id}
                            permissions={{ team: ["view"] }}
                        >
                            <Item asChild>
                                <Link to={Paths.org(slug).admin.teams}>
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
                        <Protect
                            orgId={organization.id}
                            permissions={{ member: ["view"] }}
                        >
                            <Item asChild>
                                <Link to={Paths.org(slug).admin.users}>
                                    <ItemContent>
                                        <ItemTitle>Users</ItemTitle>
                                        <ItemDescription>
                                            Manage your organisation's users and
                                            their roles.
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
