/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import type { ComponentProps } from "react";

import { MDXContent } from "@content-collections/mdx/react";
import { useQuery } from "@tanstack/react-query";

import type { HelpCardPayload } from "@/app/(public)/(marketing)/docs/help/[...slug]/route";
import { DocsFlagsProvider } from "@/components/docs/docs-flags-context";
import { KeyTerms } from "@/components/docs/key-terms";
import { docsMdxComponents } from "@/components/docs/mdx-components";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

// Cards are short and read in a narrow sheet, so they get tighter spacing than
// the `/docs` page the shared components are tuned for.
const sheetMdxComponents = {
    ...docsMdxComponents,
    p: (p: ComponentProps<"p">) => <p {...p} className="my-2.5 leading-6" />,
    ul: (p: ComponentProps<"ul">) => <ul {...p} className="my-2.5 ml-5 list-disc space-y-1" />,
    ol: (p: ComponentProps<"ol">) => <ol {...p} className="my-2.5 ml-5 list-decimal space-y-1" />,
    li: (p: ComponentProps<"li">) => <li {...p} className="leading-6" />,
};

/**
 * Global contextual-help sheet. Reads `?help=<id>` (written by `<HelpButton>`),
 * fetches that help card (`content/help/<id>.mdx`), and renders it in a side
 * sheet: the card body, its key terms, and a link to the full guide. Mounted
 * once in `src/components/providers/app-providers.tsx`.
 */
export function HelpSheet() {
    const [help, setHelp] = useQueryState("help", parseAsString);
    const open = help !== null;

    const query = useQuery({
        queryKey: ["help-card", help],
        enabled: open,
        staleTime: Infinity,
        retry: false, // a missing/hidden card will not appear on retry
        queryFn: async (): Promise<HelpCardPayload> => {
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
            <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
                <SheetHeader className="border-b px-4 py-3">
                    <SheetTitle>{query.data?.title ?? "Help"}</SheetTitle>
                    <SheetDescription>Quick Guide</SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 px-4 py-3 overflow-y-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)]">
                    {query.isPending ? (
                        <div className="flex justify-center py-12">
                            <Spinner />
                        </div>
                    ) : query.isError ? (
                        <p className="text-muted-foreground py-8 text-sm">
                            No help content is available for this page yet.
                        </p>
                    ) : (
                        <DocsFlagsProvider
                            syntheticChecksEnabled={query.data.syntheticChecksEnabled}
                        >
                            <MDXContent code={query.data.code} components={sheetMdxComponents} />
                            <KeyTerms slugs={query.data.keyTerms} className="my-4 p-3" />
                        </DocsFlagsProvider>
                    )}
                </div>

                {query.isSuccess ? (
                    <SheetFooter className="border-t px-4 py-3">
                        <Link
                            href={query.data.guideHref}
                            target="_blank"
                            rel="noopener noreferrer"
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
