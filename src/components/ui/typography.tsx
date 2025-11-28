/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cn } from "@/lib/utils";
import { tv, type VariantProps } from "tailwind-variants";

const headingVariants = tv({
    variants: {
        level: {
            1: "scroll-m-20 text-3xl lg:text-4xl font-extrabold tracking-tight text-balance",
            2: "scroll-m-20 border-b pb-2 text-2xl lg:text-3xl font-semibold tracking-tight first:mt-0",
            3: "scroll-m-20 text-2xl font-semibold tracking-tight",
            4: "scroll-m-20 text-xl font-semibold tracking-tight",
            5: "scroll-m-20 text-xl font-semibold tracking-tight",
            6: "scroll-m-20 text-xl font-semibold tracking-tight",
        },
    },
    defaultVariants: {
        level: 1,
    },
});

type HeadingProps = React.ComponentPropsWithRef<
    "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
> &
    VariantProps<typeof headingVariants>;

export function Heading({ className, level = 1, ...props }: HeadingProps) {
    const Element: `h${typeof level}` = `h${level}`;

    return (
        <Element
            {...props}
            className={cn(headingVariants({ level }), className)}
        />
    );
}

export function Paragraph({
    className,
    ...props
}: React.ComponentPropsWithRef<"p">) {
    return (
        <p
            className={cn("leading-7 not-first:mt-6 text-sm", className)}
            {...props}
        />
    );
}

export function Blockquote({
    className,
    ...props
}: React.ComponentPropsWithRef<"blockquote">) {
    return (
        <blockquote
            className={cn("mt-6 border-l-2 pl-6 italic", className)}
            {...props}
        />
    );
}

export function InlineCode({
    className,
    ...props
}: React.ComponentPropsWithRef<"code">) {
    return (
        <code
            className={cn(
                "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
                className,
            )}
            {...props}
        />
    );
}

export function Description({
    className,
    ...props
}: React.ComponentPropsWithRef<"p">) {
    return (
        <p className={cn("mt-2 text-sm text-gray-700", className)} {...props} />
    );
}

export function ObjectName({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            className={cn("font-semibold text-gray-800", className)}
            data-component="ObjectName"
            {...props}
        />
    );
}
