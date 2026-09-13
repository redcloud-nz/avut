/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The set of component sandboxes exposed by the playground area. Each entry maps
 * to a `playground/<slug>/page.tsx` and drives both the index page and the
 * in-playground contextual sidebar. This is dev tooling — not a registry module
 * (`src/lib/modules.ts` is deliberately untouched), so the playground never
 * appears in the top-level switcher or the org dashboard.
 */
export type PlaygroundEntry = {
    slug: string;
    title: string;
    description: string;
};

export const playgroundRegistry: readonly PlaygroundEntry[] = [
    {
        slug: "person-picker",
        title: "Person picker",
        description:
            "Select a person from an organization's personnel. Exercises the org-scoped personnel.listPersonnel query against the live runtime.",
    },
    {
        slug: "select",
        title: "Select",
        description:
            "Native shadcn Select next to the custom SearchableSelect, for comparing their styling side-by-side.",
    },
];
