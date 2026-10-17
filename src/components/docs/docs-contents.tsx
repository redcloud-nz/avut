/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * "On this page" for a docs guide: the guide's `##` sections with their `###` subsections nested
 * under them, highlighted as the window scrolls. The docs pages scroll the window under the
 * sticky `PublicHeader`, so the trigger line and the list's own sticky offset sit below it.
 */

"use client";

import type { Doc } from "content-collections";

import { SaratogaContents, type SaratogaContentsItem } from "@/components/blocks/saratoga-contents";

/**
 * The rendered height of the sticky `PublicHeader`: `py-3.5` around its 32px-tall row (logo,
 * icon buttons, search input) plus its 1px bottom border. The docs layout's sticky nav uses the
 * same value (`top-[61px]`).
 */
const HEADER_HEIGHT = 61;

/**
 * Depth 2 headings become top-level entries, with the depth 3 headings after them nested as
 * `children`. A depth 3 heading before any depth 2 one is a top-level entry. The page title
 * (`#`) and depth 4+ are left out.
 */
function contentsItems(headings: Doc["headings"]): SaratogaContentsItem[] {
    const items: SaratogaContentsItem[] = [];
    let children: SaratogaContentsItem[] | undefined;
    for (const { id, label, depth } of headings) {
        if (depth === 2) {
            children = [];
            items.push({ id, label, children });
        } else if (depth === 3) {
            (children ?? items).push({ id, label });
        }
    }
    return items;
}

export function DocsContents({ headings }: { headings: Doc["headings"] }) {
    return (
        <SaratogaContents
            items={contentsItems(headings)}
            offset={HEADER_HEIGHT + 24}
            className="top-[93px] lg:hidden xl:block"
        />
    );
}
