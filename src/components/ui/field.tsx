"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
    return (
        <fieldset
            data-slot="field-set"
            className={cn(
                "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
                className,
            )}
            {...props}
        />
    );
}

function FieldLegend({
    className,
    variant = "legend",
    ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
    return (
        <legend
            data-slot="field-legend"
            data-variant={variant}
            className={cn(
                "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
                className,
            )}
            {...props}
        />
    );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-group"
            className={cn(
                "group/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
                className,
            )}
            {...props}
        />
    );
}

/**
 * The two-column grid `responsive` and `inline` fields share from `sm` up, placed by slot rather
 * than position: a `FieldLabel` goes in the ⅓ label column, nudged down to line up with an 8-high
 * control; everything else — the control, then a `FieldDescription`, then a `FieldError` — stacks
 * in the ⅔ column in source order. Rows are sized by the control column alone, since the label
 * only ever occupies row 1.
 */
const alignedGrid =
    "sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start sm:gap-x-4 sm:gap-y-1.5 sm:*:col-start-2 sm:*:data-[slot=field-label]:col-start-1 sm:*:data-[slot=field-label]:row-start-1 sm:*:data-[slot=field-label]:pt-1.5 sm:*:data-[slot=field-description]:mt-0";

const fieldVariants = cva("group/field flex w-full gap-2 data-[invalid=true]:text-destructive", {
    variants: {
        orientation: {
            vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
            horizontal:
                "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
            // Stacked below `sm` (where a `DialogContent` goes full screen), then the aligned grid.
            responsive: ["flex-col *:w-full [&>.sr-only]:w-auto", alignedGrid],
            // A row at every width — label ⅓ and value ⅔ below `sm` — for a
            // short read-only value (an ID) that doesn't need a line to itself on a phone; from
            // `sm` up it joins the same aligned grid as `responsive`, so it lines up with them.
            inline: [
                "flex-row items-center *:min-w-0 *:flex-1 *:data-[slot=field-label]:flex-none *:data-[slot=field-label]:basis-1/3",
                alignedGrid,
            ],
        },
    },
    defaultVariants: {
        orientation: "vertical",
    },
});

function Field({
    className,
    orientation = "vertical",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
    return (
        <div
            role="group"
            data-slot="field"
            data-orientation={orientation}
            className={cn(fieldVariants({ orientation }), className)}
            {...props}
        />
    );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-content"
            className={cn(
                "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
                className,
            )}
            {...props}
        />
    );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
    return (
        <Label
            data-slot="field-label"
            className={cn(
                "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
                "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
                className,
            )}
            {...props}
        />
    );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-label"
            className={cn(
                "flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="field-description"
            className={cn(
                "text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
                "last:mt-0 nth-last-2:-mt-1",
                "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
                className,
            )}
            {...props}
        />
    );
}

function FieldSeparator({
    children,
    className,
    ...props
}: React.ComponentProps<"div"> & {
    children?: React.ReactNode;
}) {
    return (
        <div
            data-slot="field-separator"
            data-content={!!children}
            className={cn(
                "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
                className,
            )}
            {...props}
        >
            <Separator className="absolute inset-0 top-1/2" />
            {children && (
                <span
                    className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
                    data-slot="field-separator-content"
                >
                    {children}
                </span>
            )}
        </div>
    );
}

function FieldError({
    className,
    children,
    errors,
    ...props
}: React.ComponentProps<"div"> & {
    errors?: Array<{ message?: string } | undefined>;
}) {
    const content = useMemo(() => {
        if (children) {
            return children;
        }

        if (!errors?.length) {
            return null;
        }

        const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

        if (uniqueErrors?.length == 1) {
            return uniqueErrors[0]?.message;
        }

        return (
            <ul className="ml-4 flex list-disc flex-col gap-1">
                {uniqueErrors.map(
                    (error, index) => error?.message && <li key={index}>{error.message}</li>,
                )}
            </ul>
        );
    }, [children, errors]);

    if (!content) {
        return null;
    }

    return (
        <div
            role="alert"
            data-slot="field-error"
            className={cn("text-sm font-normal text-destructive", className)}
            {...props}
        >
            {content}
        </div>
    );
}

export {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLegend,
    FieldSeparator,
    FieldSet,
    FieldContent,
    FieldTitle,
};
