/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--select
 */

import {
    Building2Icon,
    ChevronRightIcon,
    PlusIcon,
    UserIcon,
} from "lucide-react";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Argus } from "@/components/blocks/argus";
import {
    S2_Card,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemMedia,
    ItemSeparator,
    ItemTitle,
} from "@/components/ui/items";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";

export const metadata = { title: "Select Organization" };

export default async function OrganizationSelect_Page() {
    const headers = await nextHeaders();

    const session = await auth.api.getSession({ headers });
    if (!session) redirect(Paths.auth.signIn().href);

    const organizations = await auth.api.listOrganizations({
        headers,
    });

    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />

                <S2_Card>
                    <S2_CardHeader>
                        <S2_CardTitle>Select account to use</S2_CardTitle>
                        <S2_CardDescription>
                            Signed in as <br />
                            {session.user.name} ({session.user.email}).
                        </S2_CardDescription>
                    </S2_CardHeader>
                    <S2_CardContent>
                        <ItemGroup>
                            <Item>
                                <ItemMedia>
                                    <UserIcon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>Personal Account</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Item>
                            <ItemSeparator />
                            {organizations.map((org) => (
                                <Item asChild>
                                    <Link to={Paths.org(org.slug).dashboard}>
                                        <ItemMedia>
                                            <Building2Icon className="size-5" />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>Sandbox A</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <ChevronRightIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            ))}

                            {organizations.length > 0 && <ItemSeparator />}
                            <Item asChild>
                                <Link to={Paths.orgs.create}>
                                    <ItemContent>
                                        <ItemTitle>New Organization</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <PlusIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </ItemGroup>
                    </S2_CardContent>
                </S2_Card>
            </Argus.Column>
        </Argus.Root>
    );
}
