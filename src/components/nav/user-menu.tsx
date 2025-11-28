/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { LogOutIcon } from "lucide-react";

import { useClerk, useUser } from "@clerk/nextjs";

import {
    PersonalD4HAccessTokensIcon,
    PersonalProfileIcon,
    PersonalSettingsIcon,
    SwitchOrganizationIcon,
} from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { S2_Button } from "@/components/ui/s2-button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/components/ui/link";

import { OrganizationData } from "@/lib/schemas/organization";
import { getUserInitials } from "@/lib/utils";
import * as Paths from "@/paths";

export function UserMenu({ organization }: { organization: OrganizationData }) {
    const { user } = useUser();

    const clerk = useClerk();
    const fullName = user?.fullName || "";
    const initials = getUserInitials(fullName);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <S2_Button variant="ghost" size="icon" className="size-8">
                    <Avatar className="size-6 rounded-full">
                        <AvatarImage src={user?.imageUrl} alt={fullName} />
                        <AvatarFallback className="rounded-full">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </S2_Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-md">
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-full">
                            <AvatarImage src={user?.imageUrl} alt={fullName} />
                            <AvatarFallback className="rounded-lg">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                                {fullName}
                            </span>
                            <span className="truncate text-xs">
                                {user?.primaryEmailAddress?.emailAddress}
                            </span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link
                            to={Paths.org(organization.slug).personal.profile}
                        >
                            <PersonalProfileIcon />
                            <span>
                                {
                                    Paths.org(organization.slug).personal
                                        .profile.label
                                }
                            </span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link
                            to={Paths.org(organization.slug).personal.settings}
                        >
                            <PersonalSettingsIcon />
                            <span>
                                {
                                    Paths.org(organization.slug).personal
                                        .settings.label
                                }
                            </span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link
                            to={
                                Paths.org(organization.slug).personal
                                    .d4hAccessTokens
                            }
                        >
                            <PersonalD4HAccessTokensIcon />
                            <span>
                                {
                                    Paths.org(organization.slug).personal
                                        .d4hAccessTokens.label
                                }
                            </span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link to={Paths.orgs.select}>
                            <SwitchOrganizationIcon />
                            <span>Switch Organization</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => clerk.signOut({ redirectUrl: "/" })}
                    >
                        <LogOutIcon />
                        Sign out
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
