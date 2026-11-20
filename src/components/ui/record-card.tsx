/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ChevronDownIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "./card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { DataItem, DataItemTitle, DataItemValue } from "./data-item";
import { RecordCardTimestamp } from "./record-card-timestamp";

/**
 * A detail page's card for one record (a person, a package, a subscription):
 *
 * - **Header strip:** a small muted label naming the kind of record ("Person"), so the card reads
 *   as the record without restating the page's `<h1>`. The label is the collapse toggle (a chevron
 *   after it). `action` (the edit pencil, or an open-in arrow) sits at the strip's right; the
 *   strip is the height of an icon button.
 * - **Body:** `children`, the card's contents (`CardContent` with a `DataList`), starting with a
 *   `RecordCardId` row.
 * - **Footer strip:** with `updatedAt`, "Updated <date> · 3 months ago", the same height as the
 *   header. With `historyHref` (the record's History page, where it has one) that line is a link.
 *
 * Collapsing hides the body and the footer but keeps the header and its action. It starts open;
 * the state isn't remembered.
 *
 * Server-safe: the `Collapsible` pieces and `RecordCardTimestamp` are the client parts, each its
 * own island.
 */
export function RecordCard({
    label,
    action,
    updatedAt,
    historyHref,
    children,
}: {
    label: string;
    action?: ReactNode;
    updatedAt?: Date | string;
    historyHref?: Route;
    children: ReactNode;
}) {
    return (
        <Collapsible defaultOpen asChild>
            <Card data-component="RecordCard" className="group/record gap-0 py-0">
                <header className="flex min-h-8 items-center justify-between gap-2 border-b pr-1 pl-4 group-data-[state=closed]/record:border-b-0">
                    <h2 className="flex items-center font-sans text-xs/5 font-medium tracking-wide text-muted-foreground uppercase">
                        <CollapsibleTrigger className="-mx-1 flex items-center gap-1 rounded-sm px-1 uppercase outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5">
                            {label}
                            <ChevronDownIcon
                                aria-hidden
                                className="transition-transform group-data-[state=closed]/record:-rotate-90"
                            />
                        </CollapsibleTrigger>
                    </h2>
                    {action && <div className="flex">{action}</div>}
                </header>
                <CollapsibleContent>
                    <div className="py-4">{children}</div>
                    {updatedAt && (
                        <footer className="flex min-h-8 items-center border-t px-4 text-xs text-muted-foreground">
                            {historyHref ? (
                                <Link
                                    href={historyHref}
                                    className="min-w-0 truncate underline-offset-2 hover:text-foreground hover:underline"
                                >
                                    <RecordCardTimestamp label="Updated" date={updatedAt} />
                                </Link>
                            ) : (
                                <RecordCardTimestamp label="Updated" date={updatedAt} />
                            )}
                        </footer>
                    )}
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

/**
 * The record's ID, as the first row of a `RecordCard`: an ordinary label, the value muted and in
 * mono (reference data, not something you read the record for). Inline at every width. Render it
 * as a direct child of the card's `DataList`.
 */
export function RecordCardId({ label, id }: { label: string; id: string }) {
    return (
        <DataItem inline>
            <DataItemTitle>{label}</DataItemTitle>
            <DataItemValue className="font-mono text-muted-foreground">{id}</DataItemValue>
        </DataItem>
    );
}
