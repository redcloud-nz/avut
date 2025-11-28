/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { formatDistanceToNow } from "date-fns";
import { ComponentProps } from "react";

import { Slot as SlotPrimitive } from "radix-ui";

import { NotificationsIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function Notifications({
    children,
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="notifications"
            className={cn("divide-y", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function NotificationsEmpty({
    className,
    ...props
}: Omit<ComponentProps<"div">, "children">) {
    return (
        <div
            data-slot="notifications-empty"
            className={cn(
                "flex flex-col items-center justify-center py-12 text-center",
                className,
            )}
            {...props}
        >
            <NotificationsIcon className="size-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
                No new notifications
            </p>
        </div>
    );
}

export function Notification({
    asChild,
    children,
    className,
    ...props
}: ComponentProps<"div"> & { asChild?: boolean }) {
    const Component = asChild ? SlotPrimitive.Slot : "div";

    return (
        <Component
            data-slot="notification"
            className={cn(
                "group/notification w-full flex flex-col items-stretch flex-wrap [a]:transition-colors duration-100 [a]:hover:bg-accent [a]:hover:text-accent-foreground px-4 py-3 gap-2.5",
                className,
            )}
            {...props}
        >
            {children}
        </Component>
    );
}

export function NotificationHeader({
    children,
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="notification-header"
            className={cn(
                "flex basis-full items-center justify-between gap-2",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function NotificationContent({
    children,
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="notification-content"
            className={cn("flex flex-1 flex-col gap-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function NotificationFooter({
    children,
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="notification-footer"
            className={cn(
                "flex basis-full items-center justify-between gap-2",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function NotificationTitle({
    children,
    className,
    ...props
}: ComponentProps<"h4">) {
    return (
        <div
            data-slot="notification-title"
            className={cn(
                "flex w-fit items-center gap-2 text-sm leading-snug font-medium",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function NotificationDescription({
    children,
    className,
    ...props
}: ComponentProps<"p">) {
    return (
        <p
            data-slot="notification-description"
            className={cn(
                "text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance",
                "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
                className,
            )}
            {...props}
        >
            {children}
        </p>
    );
}

export function NotificationDate({
    className,
    date,
    ...props
}: Omit<ComponentProps<"div">, "children"> & { date: Date }) {
    return (
        <div
            data-slot="notification-date"
            className={cn("text-xs text-muted-foreground", className)}
            {...props}
        >
            {formatDistanceToNow(date)} ago
        </div>
    );
}

export function UnreadIndicator({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="unread-indicator"
            className={cn("size-2 rounded-full bg-primary", className)}
            {...props}
        />
    );
}
