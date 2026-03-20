/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { NotificationsIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    Notification,
    NotificationContent,
    NotificationDate,
    NotificationDescription,
    NotificationHeader,
    Notifications,
    NotificationsEmpty,
    NotificationTitle,
    UnreadIndicator,
} from "@/components/ui/notification";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { trpc } from "@/trpc/client";

export function NotificationsMenu() {
    const [open, setOpen] = useState(false);

    const { data: notificationsData, isLoading } = useQuery(
        trpc.notifications.getUserNotifications.queryOptions(),
    );

    const notifications = notificationsData ?? [];
    const unreadCount = notifications.length;

    const handleNotificationClick = () => {
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative size-8">
                    <NotificationsIcon className="size-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="rounded-md w-120 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                </div>
                <Notifications className="max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <NotificationsEmpty />
                    ) : (
                        notifications.map((notification) => (
                            <Link
                                key={notification.id}
                                href={notification.path as Route}
                                className="block hover:bg-accent transition-colors"
                                onClick={handleNotificationClick}
                            >
                                <Notification asChild>
                                    <div>
                                        <NotificationHeader>
                                            <div className="flex items-center gap-2">
                                                <UnreadIndicator />
                                                <NotificationTitle>
                                                    {notification.title}
                                                </NotificationTitle>
                                            </div>
                                        </NotificationHeader>
                                        <NotificationContent>
                                            <NotificationDescription>
                                                {notification.description}
                                            </NotificationDescription>
                                            <NotificationDate date={new Date(notification.date)} />
                                        </NotificationContent>
                                    </div>
                                </Notification>
                            </Link>
                        ))
                    )}
                </Notifications>
            </PopoverContent>
        </Popover>
    );
}
