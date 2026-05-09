import { ComponentProps, ElementType } from "react";
import {
    CircleCheckIcon,
    CircleXIcon,
    FlaskConicalIcon,
    InfoIcon,
    TriangleAlertIcon,
} from "lucide-react";
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
            destructive: "text-destructive bg-card *:[svg]:text-current",
            error: "bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100",
            success: "bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100",
            warning: "bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100",
            underConstruction: "bg-pink-50 dark:bg-pink-950 text-pink-900 dark:text-pink-100",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const defaultIcons: Partial<Record<AlertVariant, ElementType>> = {
    default: InfoIcon,
    error: CircleXIcon,
    success: CircleCheckIcon,
    warning: TriangleAlertIcon,
    underConstruction: FlaskConicalIcon,
};

type AlertProps = ComponentProps<"div"> &
    VariantProps<typeof alertVariants> & {
        icon?: React.ReactNode | false;
    };

export function Alert({ className, variant, icon, children, ...props }: AlertProps) {
    const DefaultIcon = variant ? defaultIcons[variant] : undefined;
    const resolvedIcon = icon === false ? null : (icon ?? (DefaultIcon ? <DefaultIcon /> : null));

    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        >
            {resolvedIcon}
            {children}
        </div>
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

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                "text-current/80 [&_a]:hover:text-foreground text-xs/relaxed text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-2",
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
