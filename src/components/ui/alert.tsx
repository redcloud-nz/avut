/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    CircleCheckIcon,
    TriangleAlertIcon,
    InfoIcon,
    CircleXIcon,
    FlaskConicalIcon,
} from "lucide-react";
import { tv, VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const alertStyles = tv({
    slots: {
        root: "rounded-md p-4",
        icon: "h-5 w-5",
        title: "text-sm font-medium",
        description: "mt-2 text-sm",
        action: "ml-4 self-center shrink-0",
    },
    variants: {
        severity: {
            info: {
                root: "bg-blue-50",
                icon: "text-blue-400",
                title: "text-blue-800",
                description: "text-blue-700",
            },
            success: {
                root: "bg-green-50",
                icon: "text-green-400",
                title: "text-green-800",
                description: "text-green-700",
            },
            warning: {
                root: "bg-yellow-50",
                icon: "text-yellow-400",
                title: "text-yellow-800",
                description: "text-yellow-700",
            },
            error: {
                root: "bg-red-50",
                icon: "text-red-400",
                title: "text-red-800",
                description: "text-red-700",
            },
            mockup: {
                root: "bg-pink-50",
                icon: "text-pink-400",
                title: "text-pink-800",
                description: "text-pink-700",
            },
        },
    },
});

const alertIcons = {
    info: InfoIcon,
    success: CircleCheckIcon,
    warning: TriangleAlertIcon,
    error: CircleXIcon,
    mockup: FlaskConicalIcon,
};

export type AlertProps = React.ComponentPropsWithRef<"div"> &
    VariantProps<typeof alertStyles> & {
        action?: React.ReactNode;
        title: string;
    };

export function Alert({
    action,
    className,
    children,
    severity = "info",
    title,
    ...props
}: AlertProps) {
    const slots = alertStyles({ severity });
    const Icon = alertIcons[severity];

    return (
        <div {...props} className={cn(slots.root(), className)}>
            <div className="flex">
                <div className="shrink-0">
                    <Icon aria-hidden="true" className={slots.icon()} />
                </div>
                <div className="ml-3 grow">
                    <h3 className={slots.title()}>{title}</h3>
                    {children && (
                        <div className={slots.description()}>{children}</div>
                    )}
                </div>
                {action ? <div className={slots.action()}>{action}</div> : null}
            </div>
        </div>
    );
}
