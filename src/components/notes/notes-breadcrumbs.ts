/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { Route } from "next";

import type { SaratogaBreadcrumb } from "@/components/blocks/saratoga";

/**
 * The breadcrumb trail for a notes module's detail pane, shared by org and personal notes. On a
 * note it's "Notes", which is the way back at phone width, where the list pane is hidden. On a
 * note's History, pass `note` too and its title links back to the note. The notes index (and the
 * list pane) has no trail.
 */
export function notesBreadcrumbs(
    listHref: Route,
    note?: { title: string; href: Route },
): SaratogaBreadcrumb[] {
    return note
        ? [
              { label: "Notes", href: listHref },
              { label: note.title, href: note.href },
          ]
        : [{ label: "Notes", href: listHref }];
}
