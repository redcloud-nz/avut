import { ComponentProps } from "react";
import { tv, VariantProps } from "tailwind-variants";
import { cn } from "@/lib/utils";

const alertVariants = tv({
    base: cn(
        // Base styles
        "grid gap-0.5 rounded-none border px-2.5 py-2 text-left text-xs w-full relative group/alert",

        "has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18",
        "has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2",
        "*:[svg]:row-span-2 *:[svg]:translate-y-0 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 ",
    ),

    variants: {
        variant: {
            default: "bg-card text-card-foreground",
            destructive:
                "text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
            warning:
                "bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100",
            underConstruction:
                "bg-pink-50 dark:bg-pink-950 text-pink-900 dark:text-pink-100",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export function Alert({
    className,
    variant,
    ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

export function AlertTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-title"
            className={cn(
                "[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDescription({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                "text-muted-foreground [&_a]:hover:text-foreground text-xs/relaxed text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-2",
                className,
            )}
            {...props}
        />
    );
}

export function AlertAction({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-action"
            className={cn(
                "absolute top-[calc(--spacing(1.25))] right-[calc(--spacing(1.25))]",
                className,
            )}
            {...props}
        />
    );
}
