/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Renders one release's "What's new" entry. Shared by the public `/docs/updates` page (a
 * Server Component) and the in-app What's new dialog (a Client Component), so it
 * holds no hooks and no server-only imports.
 */

import Link from "next/link";

import { MDXContent } from "@content-collections/mdx/react";

import { docsMdxComponents } from "@/components/docs/mdx-components";
import { Badge } from "@/components/ui/badge";
import { updatesHref, type UpdateEntryData } from "@/lib/updates-shared";
import { cn } from "@/lib/utils";

// The article renders its own title, so drop any leading <h1> an author left in the body
// (as `help-sheet.tsx` does).
const updateMdxComponents = { ...docsMdxComponents, h1: () => null };

interface UpdateArticleProps {
    entry: UpdateEntryData;
    /** The title's heading level: `h2` on `/docs/updates` (under its `h1`), `h3` where it nests deeper. */
    headingLevel?: "h2" | "h3";
    /**
     * Open the title's link to the entry on `/docs/updates` in a new tab. The in-app dialog sets
     * this: that page sits outside the app shell, so following it in place would leave the app.
     */
    linkInNewTab?: boolean;
    className?: string;
}

/** One release's entry: an anchored title, its version, and the MDX body. */
export function UpdateArticle({
    entry,
    headingLevel = "h2",
    linkInNewTab = false,
    className,
}: UpdateArticleProps) {
    const Heading = headingLevel;

    return (
        <article id={entry.slug} className={cn("scroll-mt-20", className)}>
            <header className="mb-2">
                <Heading
                    className={cn(
                        "font-semibold tracking-tight",
                        headingLevel === "h2" ? "text-2xl" : "text-base",
                    )}
                >
                    <Link
                        href={updatesHref(entry.slug)}
                        className="hover:underline"
                        {...(linkInNewTab && { target: "_blank", rel: "noopener noreferrer" })}
                    >
                        {entry.title}
                        {linkInNewTab && <span className="sr-only"> (opens in a new tab)</span>}
                    </Link>
                </Heading>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <Badge variant="outline">v{entry.version}</Badge>
                    {entry.description && <span>{entry.description}</span>}
                </div>
            </header>
            <MDXContent code={entry.mdx} components={updateMdxComponents} />
        </article>
    );
}
