/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Loader2Icon, RefreshCcw, TrashIcon } from "lucide-react";
import React, { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import {
    Popover,
    PopoverArrow,
    PopoverClose,
    PopoverContent,
    PopoverTrigger,
} from "./popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export const buttonVariants = tv({
    base: "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    variants: {
        variant: {
            default: "",
            outline: "border bg-background hover:bg-accent",
            ghost: "hover:bg-accent active:bg-accent/50 active:text-accent-foreground/50",
            link: "text-primary underline-offset-4 hover:underline",
        },
        color: {
            primary: "",
            secondary: "",
            destructive: "",
            blue: "",
            red: "",
        },
        size: {
            default: "h-10 rounded-md px-4 py-2",
            sm: "h-8 rounded-md px-3 py-1",
            lg: "h-11 rounded-md px-8",
            icon: "h-10 w-10",
        },
    },
    compoundVariants: [
        {
            variant: "default",
            color: "primary",
            class: "bg-primary text-primary-foreground hover:bg-primary/90",
        },
        {
            variant: "default",
            color: "secondary",
            class: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        },
        {
            variant: "default",
            color: "destructive",
            class: "bg-destructive text-background hover:bg-destructive/90",
        },
        {
            variant: "default",
            color: "blue",
            class: "bg-blue-600 text-background hover:bg-blue-500/90 active:bg-blue-500/75",
        },
        {
            variant: "default",
            color: "red",
            class: "bg-red-600 text-background hover:bg-red-500/90 active:bg-red-500/75",
        },

        {
            variant: "outline",
            color: "primary",
            class: "border-primary hover:text-primary/90",
        },
        {
            variant: "outline",
            color: "secondary",
            class: "border-secondary hover:text-secondary/90",
        },
        {
            variant: "outline",
            color: "destructive",
            class: "border-destructive text-destructive hover:text-destructive/90",
        },
        {
            variant: "outline",
            color: "blue",
            class: "border-blue-600 text-blue-600 hover:bg-blue-600/10",
        },
        {
            variant: "outline",
            color: "red",
            class: "border-red-600 text-red-600 hover:bg-red-600/10",
        },

        {
            variant: "ghost",
            color: "primary",
            class: "text-primary hover:text-primary/90",
        },
        {
            variant: "ghost",
            color: "secondary",
            class: "text-secondary hover:text-secondary/80",
        },
        {
            variant: "ghost",
            color: "destructive",
            class: "text-destructive hover:text-destructive/90",
        },
        {
            variant: "ghost",
            color: "blue",
            class: "text-blue-600 hover:text-blue-600/90",
        },
        {
            variant: "ghost",
            color: "red",
            class: "text-red-600 hover:text-red-600/90",
        },

        { variant: "ghost", size: "icon", class: "rounded-full" },
    ],
    defaultVariants: {
        variant: "default",
        color: "primary",
        size: "default",
    },
});

export type ButtonProps = ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    };

/**
 * A button component that can be used to trigger actions or navigate to other pages.
 * @param className Additional class names to apply to the button.
 * @param variant The variant of the button. Can be one of 'default', 'destructive', 'outline-solid', 'secondary', 'ghost', or 'link'.
 * @param size The size of the button. Can be one of 'default', 'sm', 'lg', or 'icon'.
 * @param asChild If true, the button will be rendered using the SlotPrimitive.Slot component.
 *
 * @see https://ui.shadcn.com/docs/components/button
 */
export function Button({
    className,
    variant,
    color,
    size,
    asChild = false,
    ...props
}: ButtonProps) {
    const Comp = asChild ? SlotPrimitive.Slot : "button";
    return (
        <Comp
            className={cn(buttonVariants({ className, color, size, variant }))}
            {...props}
        />
    );
}

export type AsyncButtonProps = ButtonProps & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<any>;
    label?: React.ReactNode;
    pending?: React.ReactNode;
    done?: React.ReactNode;
    reset?: boolean;
};

export function AsyncButton({
    children,
    className,
    color,
    disabled,
    variant,
    size,
    onClick,
    label,
    pending,
    done,
    reset,
    ...props
}: AsyncButtonProps) {
    const [state, setState] = React.useState<"ready" | "pending" | "done">(
        "ready",
    );

    async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
        if (onClick) {
            setState("pending");
            await onClick(event);
            setState(reset ? "ready" : "done");
        }
    }

    return (
        <button
            className={cn(
                "group",
                buttonVariants({ className, color, size, variant }),
            )}
            disabled={state != "ready" || disabled}
            onClick={handleClick}
            data-state={state}
            {...props}
        >
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin hidden group-data-[state=pending]:inline" />
            {label ? (
                <SubmitButtonLabel activeState="ready">
                    {label}
                </SubmitButtonLabel>
            ) : null}
            {pending ? (
                <SubmitButtonLabel activeState="pending">
                    {pending}
                </SubmitButtonLabel>
            ) : null}
            {done ? (
                <SubmitButtonLabel activeState="done">{done}</SubmitButtonLabel>
            ) : null}
            {children}
        </button>
    );
}

export type SubmitButtonProps = ButtonProps & {
    state: "ready" | "pending" | "done";
    label?: React.ReactNode;
    pending?: React.ReactNode;
    done?: React.ReactNode;
};

export function SubmitButton({
    children,
    className,
    disabled,
    variant,
    size,
    state,
    label,
    pending,
    done,
    ...props
}: SubmitButtonProps) {
    return (
        <button
            className={cn(
                "group",
                buttonVariants({ variant, size, className }),
            )}
            disabled={state != "ready" || disabled}
            data-state={state}
            {...props}
        >
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin hidden group-data-[state=pending]:inline" />
            {label ? (
                <SubmitButtonLabel activeState="ready">
                    {label}
                </SubmitButtonLabel>
            ) : null}
            {pending ? (
                <SubmitButtonLabel activeState="pending">
                    {pending}
                </SubmitButtonLabel>
            ) : null}
            {done ? (
                <SubmitButtonLabel activeState="done">{done}</SubmitButtonLabel>
            ) : null}
            {children}
        </button>
    );
}

export type SubmitButtonLabelProps = ComponentProps<"span"> & {
    activeState: "ready" | "pending" | "done";
};

export function SubmitButtonLabel({
    children,
    className,
    activeState,
    ...props
}: SubmitButtonLabelProps) {
    return (
        <span
            className={cn(
                "hidden",
                activeState == "ready" && "group-data-[state=ready]:inline",
                activeState == "pending" && "group-data-[state=pending]:inline",
                activeState == "done" && "group-data-[state=done]:inline",
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}

export function DeleteConfirmButton({
    onDelete,
    ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & { onDelete: () => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" {...props}>
                    <TrashIcon />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 flex justify-between items-center gap-2"
                side="left"
            >
                <div className="font-semibold">Confirm?</div>
                <div className="flex gap-2">
                    <PopoverClose asChild>
                        <Button
                            color="destructive"
                            size="sm"
                            onClick={onDelete}
                        >
                            Delete
                        </Button>
                    </PopoverClose>
                    <PopoverClose asChild>
                        <Button variant="ghost" size="sm" autoFocus>
                            Cancel
                        </Button>
                    </PopoverClose>
                </div>
                <PopoverArrow className="fill-destructive border-border" />
            </PopoverContent>
        </Popover>
    );
}

type ConfirmPopupButtonProps = Omit<
    ComponentProps<typeof Button>,
    "onClick"
> & {
    message?: React.ReactNode;
    slotProps?: {
        popoverContent?: ComponentProps<typeof PopoverContent>;
        confirmButton?: ComponentProps<typeof Button>;
        cancelButton?: ComponentProps<typeof Button>;
    };
    tooltip?: React.ReactNode;
};

export function ConfirmPopupButton({
    children,
    message = "Confirm",
    slotProps = {},
    tooltip,
    ...props
}: ConfirmPopupButtonProps) {
    const { className: popoverContentClassName, ...popoverContentProps } =
        slotProps.popoverContent || {};

    return (
        <Popover>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" {...props}>
                            {children}
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                {tooltip ? <TooltipContent>{tooltip}</TooltipContent> : null}
            </Tooltip>
            <PopoverContent
                className={cn(
                    "w-64 flex justify-between items-center gap-2",
                    popoverContentClassName,
                )}
                side="left"
                {...popoverContentProps}
            >
                <div className="font-semibold">{message}</div>
                <div className="flex gap-2">
                    <PopoverClose asChild>
                        <Button
                            color="destructive"
                            size="sm"
                            {...(slotProps.confirmButton ?? {})}
                        />
                    </PopoverClose>
                    <PopoverClose asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            autoFocus
                            {...{
                                children: "Cancel",
                                ...(slotProps.cancelButton ?? {}),
                            }}
                        />
                    </PopoverClose>
                </div>
                <PopoverArrow className="fill-destructive border-border" />
            </PopoverContent>
        </Popover>
    );
}

export function RefreshButton<R>({
    onClick,
    ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & {
    onClick: () => Promise<R>;
}) {
    const [running, setRunning] = React.useState(false);

    async function handleClick() {
        if (running) return;
        setRunning(true);
        await onClick();
        setRunning(false);
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClick}
                    {...props}
                >
                    <RefreshCcw className={running ? "animate-spin" : ""} />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <span>Refresh results</span>
                {running ? (
                    <span className="text-muted-foreground">Refreshing...</span>
                ) : null}
            </TooltipContent>
        </Tooltip>
    );
}
