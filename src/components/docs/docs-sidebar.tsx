/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { docsHref, type DocsNavSection } from "@/lib/docs";
import { cn } from "@/lib/utils";

/** Left-hand navigation for the public `/docs` site, built from the compiled collection. */
export function DocsSidebar({ nav }: { nav: DocsNavSection[] }) {
    const pathname = usePathname();

    return (
        <nav className="flex flex-col gap-6 text-sm">
            <Link
                href={docsHref("")}
                className={cn(
                    "font-semibold hover:underline",
                    pathname === "/docs" && "text-primary",
                )}
            >
                Overview
            </Link>
            {nav.map((section) => (
                <div key={section.id} className="flex flex-col gap-1">
                    <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                        {section.title}
                    </p>
                    {section.pages.map((page) => {
                        const href = docsHref(page.slug);
                        return (
                            <Link
                                key={page.slug}
                                href={href}
                                className={cn(
                                    "hover:text-foreground text-muted-foreground rounded px-2 py-1 -mx-2",
                                    pathname === href && "bg-muted text-foreground font-medium",
                                )}
                            >
                                {page.title}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
}
