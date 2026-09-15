/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MiniSearch from "minisearch";

import type { DocsSearchRecord } from "@/app/(public)/(marketing)/docs/search-index.json/route";
import { Input } from "@/components/ui/input";
import { docsHref } from "@/lib/docs-sections";
import { cn } from "@/lib/utils";

type Result = Pick<DocsSearchRecord, "slug" | "title" | "section" | "description">;

/** Client-side docs search. Loads the static index lazily on first focus. */
export function DocsSearch() {
    const router = useRouter();
    const listboxId = useId();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [records, setRecords] = useState<DocsSearchRecord[] | null>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
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
            if (!res.ok) throw new Error(`search index ${res.status}`);
            setRecords((await res.json()) as DocsSearchRecord[]);
        } catch {
            setRecords([]);
        }
    }

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    const results: Result[] = useMemo(() => {
        if (!engine || query.trim().length < 2) return [];
        return engine.search(query).slice(0, 8) as unknown as Result[];
    }, [engine, query]);

    // Keep the active option in range as the result set changes underneath it.
    useEffect(() => {
        setActiveIndex(results.length === 0 ? -1 : 0);
    }, [results]);

    function select(r: Result) {
        setOpen(false);
        setQuery("");
        router.push(docsHref(r.slug));
    }

    const showPopover = open && query.trim().length >= 2;

    return (
        <div ref={containerRef} className="relative">
            <Input
                type="search"
                role="combobox"
                aria-expanded={showPopover}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                    showPopover && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
                }
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
                onKeyDown={(e) => {
                    if (!showPopover || results.length === 0) return;
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((i) => (i + 1) % results.length);
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((i) => (i - 1 + results.length) % results.length);
                    } else if (e.key === "Enter" && activeIndex >= 0) {
                        e.preventDefault();
                        select(results[activeIndex]);
                    }
                }}
            />
            {showPopover && (
                <div
                    id={listboxId}
                    role="listbox"
                    className="bg-popover absolute right-0 z-50 mt-1 w-80 rounded-md border p-1 shadow-md"
                >
                    {results.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">No matches.</p>
                    ) : (
                        results.map((r, i) => (
                            <Link
                                key={r.slug}
                                id={`${listboxId}-${i}`}
                                role="option"
                                aria-selected={i === activeIndex}
                                href={docsHref(r.slug)}
                                onMouseEnter={() => setActiveIndex(i)}
                                onClick={() => {
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={cn(
                                    "block rounded px-2 py-1.5 text-sm",
                                    i === activeIndex ? "bg-muted" : "hover:bg-muted",
                                )}
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
