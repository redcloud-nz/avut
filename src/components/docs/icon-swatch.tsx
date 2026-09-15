/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ChevronDownIcon,
    MoonIcon,
    PanelLeftIcon,
    SunIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { DropdownMenuTriggerIcon, FilterColumnValuesIcon, ObjectIcons } from "@/components/icons";

// The app's actual icon for each control, not an approximation — keep this in sync if the
// underlying icon changes in nav/, icons.tsx, or the Kaga table headers.
const DOCS_ICONS = {
    sun: SunIcon,
    moon: MoonIcon,
    pencil: ObjectIcons.Edit,
    "more-vertical": DropdownMenuTriggerIcon,
    "chevron-down": ChevronDownIcon,
    "sort-asc": ArrowDownAZIcon,
    "sort-desc": ArrowDownZAIcon,
    filter: FilterColumnValuesIcon,
    "panel-left": PanelLeftIcon,
} as const satisfies Record<string, ComponentType<{ className?: string }>>;

export type DocsIconName = keyof typeof DOCS_ICONS;

/** A labelled swatch showing one of the app's real icons, for docs reference pages. */
export function DocsIcon({ name, label }: { name: DocsIconName; label?: string }) {
    const Icon = DOCS_ICONS[name];
    return (
        <span className="my-1 mr-2 inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 align-middle text-sm">
            <Icon className="size-4" />
            {label}
        </span>
    );
}
