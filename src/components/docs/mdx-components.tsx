/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The component set MDX in `content/docs/**` renders against. Element overrides
 * give the docs their typographic style without a global prose stylesheet;
 * `<Callout>` and `<Keys>` are the custom components authors may use directly.
 */

import type { ComponentProps, ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";

import { Screenshot, UnsupportedImg } from "@/components/docs/screenshot";
import { Alert } from "@/components/ui/alert";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type CalloutVariant = "default" | "warning" | "success" | "error";

/** A highlighted aside. `type` maps to the shared `<Alert>` variants. */
export function Callout({
    type = "default",
    children,
}: {
    type?: CalloutVariant;
    children: ReactNode;
}) {
    return (
        <Alert variant={type} className="my-4 text-sm [&_p]:my-0">
            {children}
        </Alert>
    );
}

/** Render a keyboard shortcut, e.g. `<Keys combo="mod+k" />` or `<Keys>Esc</Keys>`. */
export function Keys({ combo, children }: { combo?: string; children?: ReactNode }) {
    if (combo) {
        return (
            <span className="inline-flex gap-1">
                {combo.split("+").map((key) => (
                    <Kbd key={key}>{key === "mod" ? "⌘" : key}</Kbd>
                ))}
            </span>
        );
    }
    return <Kbd>{children}</Kbd>;
}

function DocLink({ href = "", ...props }: ComponentProps<"a">) {
    const external = /^https?:\/\//.test(href);
    if (external) {
        return (
            <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:no-underline"
            />
        );
    }
    return (
        <Link
            {...props}
            href={href as Route}
            className="text-primary underline underline-offset-2 hover:no-underline"
        />
    );
}

export const docsMdxComponents = {
    h1: (p: ComponentProps<"h1">) => (
        <h1 {...p} className="mt-2 mb-4 scroll-mt-20 text-3xl font-bold tracking-tight" />
    ),
    h2: (p: ComponentProps<"h2">) => (
        <h2 {...p} className="mt-10 mb-3 scroll-mt-20 border-b pb-1 text-2xl font-semibold" />
    ),
    h3: (p: ComponentProps<"h3">) => (
        <h3 {...p} className="mt-6 mb-2 scroll-mt-20 text-xl font-semibold" />
    ),
    p: (p: ComponentProps<"p">) => <p {...p} className="my-4 leading-7" />,
    ul: (p: ComponentProps<"ul">) => <ul {...p} className="my-4 ml-6 list-disc space-y-2" />,
    ol: (p: ComponentProps<"ol">) => <ol {...p} className="my-4 ml-6 list-decimal space-y-2" />,
    li: (p: ComponentProps<"li">) => <li {...p} className="leading-7" />,
    a: DocLink,
    blockquote: (p: ComponentProps<"blockquote">) => (
        <blockquote {...p} className="text-muted-foreground my-4 border-l-2 pl-4 italic" />
    ),
    code: ({ className, ...p }: ComponentProps<"code">) => (
        <code
            {...p}
            className={cn(
                className,
                !className &&
                    "bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em] before:content-none after:content-none",
            )}
        />
    ),
    pre: (p: ComponentProps<"pre">) => (
        <pre {...p} className="bg-muted my-4 overflow-x-auto rounded-lg p-4 text-sm" />
    ),
    hr: (p: ComponentProps<"hr">) => <hr {...p} className="my-8" />,
    table: (p: ComponentProps<"table">) => (
        <div className="my-4 overflow-x-auto">
            <table {...p} className="w-full text-sm" />
        </div>
    ),
    th: (p: ComponentProps<"th">) => (
        <th {...p} className="border-b px-3 py-2 text-left font-semibold" />
    ),
    td: (p: ComponentProps<"td">) => <td {...p} className="border-b px-3 py-2 align-top" />,
    img: UnsupportedImg,
    Callout,
    Keys,
    Screenshot,
};
