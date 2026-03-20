/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
    PersonalProfileIcon,
    PersonalSettingsIcon,
    SwitchOrganizationIcon,
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

import { authClient } from "@/client/auth-client";
import { getUserInitials } from "@/lib/utils";

export function UserMenu({ slug }: { slug: string }) {
    const router = useRouter();
    const t = useTranslations("UserMenu");

    const { data: session } = authClient.useSession();
    if (!session) return null;

    const user = session.user;

    const initials = getUserInitials(user.name);

    function handleSignOut() {
        toast.promise(authClient.signOut(), {
            loading: "Signing out...",
            success: "Signed out successfully",
            error: (error) => `Error signing out: ${error.message}`,
        });

        router.push("/auth/sign-in");
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                    <Avatar className="size-6 rounded-full">
                        <AvatarImage src={user.image ?? ""} alt={user.name} />
                        <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50">
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-full">
                            <AvatarImage src={user.image ?? ""} alt={user.name} />
                            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">{user.name}</span>
                            <span className="truncate text-xs">{user.email}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("personalSection")}</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                        <Link href={`/main/${slug}/account/profile`}>
                            <PersonalProfileIcon />
                            <span>{t("profile")}</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href={`/main/${slug}/account/settings`}>
                            <PersonalSettingsIcon />
                            <span>{t("settings")}</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href={`/main/--select-org`}>
                            <SwitchOrganizationIcon />
                            <span>{t("switchOrganization")}</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOutIcon />
                        <span>{t("signOut")}</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
