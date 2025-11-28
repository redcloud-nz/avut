/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganizationList } from "@clerk/nextjs";

import { NotificationsIcon } from "@/components/icons";
import { S2_Button } from "@/components/ui/s2-button";
import { Link } from "@/components/ui/link";
import {
    Notification,
    NotificationContent,
    NotificationDate,
    NotificationDescription,
    NotificationFooter,
    NotificationHeader,
    Notifications,
    NotificationsEmpty,
    NotificationTitle,
    UnreadIndicator,
} from "../ui/notification";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import * as Paths from "@/paths";

export function NotificationsMenu() {
    const { isLoaded, userInvitations } = useOrganizationList({
        userInvitations: { status: "pending" },
    });

    const invitations = isLoaded ? (userInvitations.data ?? []) : [];

    const notificationCount = invitations.length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <S2_Button
                    variant="ghost"
                    size="icon"
                    className="relative size-8"
                >
                    <NotificationsIcon className="size-5" />
                    {notificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 size-4 flex items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                            {notificationCount > 9 ? "9+" : notificationCount}
                        </span>
                    )}
                </S2_Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="rounded-md w-120 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                </div>
                <Notifications className="max-h-[400px] overflow-y-auto">
                    {notificationCount === 0 ? (
                        <NotificationsEmpty />
                    ) : (
                        <div className="divide-y">
                            {invitations.map((invitation) => (
                                <Notification key={invitation.id} asChild>
                                    <Link to={Paths.orgs.select}>
                                        <NotificationHeader>
                                            <NotificationTitle>
                                                Organization Invitation
                                            </NotificationTitle>
                                            <UnreadIndicator />
                                        </NotificationHeader>
                                        <NotificationContent>
                                            <NotificationDescription>
                                                You have been invited to join
                                                the organization "
                                                {
                                                    invitation
                                                        .publicOrganizationData
                                                        .name
                                                }
                                                ".
                                            </NotificationDescription>
                                        </NotificationContent>
                                        <NotificationFooter>
                                            <NotificationDate
                                                date={invitation.createdAt}
                                            />
                                        </NotificationFooter>
                                    </Link>
                                </Notification>
                            ))}
                        </div>
                    )}
                </Notifications>
            </PopoverContent>
        </Popover>
    );
}
