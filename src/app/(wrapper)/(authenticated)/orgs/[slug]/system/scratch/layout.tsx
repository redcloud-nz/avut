/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/system/scratch
 */

import { notFound } from "next/navigation";

import { scratchFlag } from "@/lib/flags";

// Flag-only gate, as for the playground: scratch pages are committed on working branches, and
// the `scratch` flag (off in production) keeps any that reach a deployment from being served.
// A layout check is enough here: scratch pages are throwaway UI that read through tRPC, so the
// procedures still guard the data.
export default async function Scratch_Layout(props: LayoutProps<"/orgs/[slug]/system/scratch">) {
    if (!(await scratchFlag())) notFound();

    return props.children;
}
