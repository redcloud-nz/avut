/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MiniSearch from "minisearch";

import type { DocsSearchRecord } from "@/app/(public)/docs/search-index.json/route";
import { Input } from "@/components/ui/input";
import { docsHref } from "@/lib/docs";
import { cn } from "@/lib/utils";

type Result = Pick<DocsSearchRecord, "slug" | "title" | "section" | "description">;

/** Client-side docs search. Loads the static index lazily on first focus. */
export function DocsSearch() {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [records, setRecords] = useState<DocsSearchRecord[] | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const engine = useMemo(() => {
        if (!records) return null;
        const ms = new MiniSearch<DocsSearchRecord>({
            fields: ["title", "section", "description", "body"],
            storeFields: ["slug", "title", "section", "description"],
            searchOptions: { boost: { title: 3, section: 2 }, fuzzy: 0.2, prefix: true },
        });
        ms.addAll(records);
        return ms;
    }, [records]);

    async function loadIndex() {
        if (records) return;
        try {
            const res = await fetch("/docs/search-index.json");
            setRecords((await res.json()) as DocsSearchRecord[]);
        } catch {
            setRecords([]);
        }
    }

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const results: Result[] = useMemo(() => {
        if (!engine || query.trim().length < 2) return [];
        return engine.search(query).slice(0, 8) as unknown as Result[];
    }, [engine, query]);

    return (
        <div ref={containerRef} className="relative">
            <Input
                type="search"
                placeholder="Search docs…"
                className="h-8 w-40 sm:w-56"
                value={query}
                onFocus={() => {
                    setOpen(true);
                    void loadIndex();
                }}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                }}
            />
            {open && query.trim().length >= 2 && (
                <div className="bg-popover absolute right-0 z-50 mt-1 w-80 rounded-md border p-1 shadow-md">
                    {results.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">No matches.</p>
                    ) : (
                        results.map((r) => (
                            <Link
                                key={r.slug}
                                href={docsHref(r.slug)}
                                onClick={() => {
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={cn("hover:bg-muted block rounded px-2 py-1.5 text-sm")}
                            >
                                <span className="font-medium">{r.title}</span>
                                <span className="text-muted-foreground ml-2 text-xs">
                                    {r.section}
                                </span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
