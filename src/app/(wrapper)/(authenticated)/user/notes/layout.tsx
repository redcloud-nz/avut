/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/notes
 */

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { UserNotes_Breadcrumbs, UserNotes_List } from "@/components/notes/user-notes-list";
import { resolveUserModuleFlags } from "@/server/module-flags";
import { requireSession } from "@/server/session";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function UserNotes_Layout(props: LayoutProps<"/user/notes">) {
    // Personal notes share the `notes-module` flag with org notes. Both calls are cached per
    // request, having already run in the authenticated layout. Sequential, as there: flag
    // evaluation uses `Math.random()`, which prerendering rejects until the session read has made
    // the render dynamic.
    await requireSession();
    const userModuleFlags = await resolveUserModuleFlags();

    if (!userModuleFlags["user-notes"]) notFound();

    prefetch(trpc.userNotes.listNotes.queryOptions());

    const helpButton = <HelpButton id="notes" />;

    return (
        <HydrateClient>
            <Suspense fallback={<Std.Navbar breadcrumbs={["Notes"]} actions={helpButton} />}>
                <UserNotes_Breadcrumbs actions={helpButton} />
            </Suspense>
            <Hermes.Root>
                <Hermes.List>
                    <UserNotes_List />
                </Hermes.List>
                <Hermes.Detail>{props.children}</Hermes.Detail>
            </Hermes.Root>
        </HydrateClient>
    );
}
