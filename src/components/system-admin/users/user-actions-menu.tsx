/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type RouterOutput } from "@/trpc/client";

type SystemAdminUser = RouterOutput["systemAdmin"]["getUser"];

/**
 * Actions dropdown for a system-admin user detail page.
 *
 * Intentionally empty for now — later phases (impersonate, set role, ban/unban,
 * revoke sessions, delete) add items here.
 */
export function SystemAdmin_UserActions_Menu({ user }: { user: SystemAdminUser }) {
    void user;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
