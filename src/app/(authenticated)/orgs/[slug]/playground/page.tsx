/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground
 */

import type { Route } from "next";
import Link from "next/link";

import { Std } from "@/components/blocks/std";

import { requireOrganization } from "@/server/organization-access";

import { playgroundRegistry } from "./_registry";

export default async function Playground_Index_Page(props: PageProps<"/orgs/[slug]/playground">) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Playground"]} />
            <Std.ScrollContainer>
                <div className="mx-auto w-full max-w-3xl space-y-4">
                    <header className="space-y-0.5">
                        <h1 className="text-xl font-semibold">UI component playground</h1>
                        <p className="text-sm text-muted-foreground">
                            Live sandboxes for exercising components against the real app runtime —
                            session, current org, tRPC, query client. Nothing here is persisted.
                        </p>
                    </header>

                    <ul className="space-y-2">
                        {playgroundRegistry.map((entry) => (
                            <li key={entry.slug}>
                                <Link
                                    href={`/orgs/${slug}/playground/${entry.slug}` as Route}
                                    className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                                >
                                    <div className="font-medium">{entry.title}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {entry.description}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
