/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { MDXContent } from "@content-collections/mdx/react";
import { useQuery } from "@tanstack/react-query";

import { docsMdxComponents } from "@/components/docs/mdx-components";

// The sheet header already shows the doc title, so drop the body's leading <h1>.
const sheetMdxComponents = { ...docsMdxComponents, h1: () => null };
import { Spinner } from "@/components/ui/spinner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import type { DocsHelpPayload } from "@/app/(public)/docs/help/[...slug]/route";
import { docsHref } from "@/lib/docs";

/**
 * Global contextual-help sheet. Reads `?help=<slug>` (written by `<HelpButton>`),
 * fetches the compiled MDX for that doc, and renders it in a side sheet — the
 * same content as the public `/docs/<slug>` page. Mounted once in
 * `src/components/providers.tsx`.
 */
export function HelpSheet() {
    const [help, setHelp] = useQueryState("help", parseAsString);
    const open = help !== null;

    const query = useQuery({
        queryKey: ["docs-help", help],
        enabled: open,
        staleTime: Infinity,
        retry: false, // a missing/hidden doc will not appear on retry
        queryFn: async (): Promise<DocsHelpPayload> => {
            const res = await fetch(`/docs/help/${help}`);
            if (!res.ok) throw new Error(`Help content not found for "${help}"`);
            return res.json();
        },
    });

    function onOpenChange(next: boolean) {
        if (!next) void setHelp(null, { history: "replace" });
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
                <SheetHeader className="border-b">
                    <SheetTitle>{query.data?.title ?? "Help"}</SheetTitle>
                    <SheetDescription>
                        {query.data?.description ?? "From the AVUT documentation"}
                    </SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 px-4 py-2">
                    {query.isPending ? (
                        <div className="flex justify-center py-12">
                            <Spinner />
                        </div>
                    ) : query.isError ? (
                        <p className="text-muted-foreground py-8 text-sm">
                            No help content is available for this page yet.
                        </p>
                    ) : (
                        <MDXContent code={query.data.code} components={sheetMdxComponents} />
                    )}
                </div>

                {help && !query.isError ? (
                    <SheetFooter className="border-t">
                        <Link
                            href={docsHref(query.data?.slug ?? help)}
                            className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                        >
                            Open the full guide
                            <ArrowUpRightIcon className="size-3.5" />
                        </Link>
                    </SheetFooter>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
