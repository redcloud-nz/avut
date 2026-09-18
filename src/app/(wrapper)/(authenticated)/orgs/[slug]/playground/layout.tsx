/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground
 */

import { notFound } from "next/navigation";

import { playgroundFlag } from "@/lib/flags";

export const metadata = {
    title: "Playground",
};

// No `requireOrganization` call here — its result was unused, kept only for the org-access
// side effect, and every page under `playground/` already calls it independently (same as
// every other module's pages). Dropping it here removes a blocking DB round trip from every
// navigation into this module without weakening the actual security gate. See issue #212.
export default async function Playground_Layout(props: LayoutProps<"/orgs/[slug]/playground">) {
    // Flag-only gate — not a settings-gated module, so there is no
    // `settings.modules.*.enabled` check. When the flag is on, any signed-in org
    // member can reach the playground; individual pages add their own <Protect>
    // if they need to render something a plain member shouldn't.
    if (!(await playgroundFlag())) notFound();

    return props.children;
}
