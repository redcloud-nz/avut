/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import {
    PersonalD4HAccessTokensIcon,
    PersonalProfileIcon,
    PersonalSettingsIcon,
} from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

import { authClient } from "@/lib/auth-client";
import { getUserInitials } from "@/lib/utils";
import * as Paths from "@/paths";

export function UserMenu() {
    const router = useRouter();

    const { data: session } = authClient.useSession();
    if (!session) return null;

    const user = session.user;

    const initials = getUserInitials(user.name);

    function handleSignOut() {
        authClient.signOut();

        router.push(Paths.auth.signIn().href);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                    <Avatar className="size-6 rounded-full">
                        <AvatarImage src={user.image ?? ""} alt={user.name} />
                        <AvatarFallback className="rounded-full">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-md">
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-full">
                            <AvatarImage
                                src={user.image ?? ""}
                                alt={user.name}
                            />
                            <AvatarFallback className="rounded-lg">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                                {user.name}
                            </span>
                            <span className="truncate text-xs">
                                {user.email}
                            </span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link to={Paths.personal.profile}>
                            <PersonalProfileIcon />
                            <span>{Paths.personal.profile.label}</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link to={Paths.personal.settings}>
                            <PersonalSettingsIcon />
                            <span>{Paths.personal.settings.label}</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link to={Paths.personal.d4hAccessTokens}>
                            <PersonalD4HAccessTokensIcon />
                            <span>{Paths.personal.d4hAccessTokens.label}</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {/* <DropdownMenuItem asChild>
                        <Link to={Paths.orgs.select}>
                            <SwitchOrganizationIcon />
                            <span>Switch Organization</span>
                        </Link>
                    </DropdownMenuItem> */}
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOutIcon />
                        Sign out
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
