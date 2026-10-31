/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-nag
 */

import { Std } from "@/components/blocks/std";
import { route } from "@/lib/routes";

/** Placeholder until the rules list lands (d4h-nag plan, Task 13). */
export default async function D4HNag_Index_Page(props: PageProps<`/orgs/[slug]/d4h-nag`>) {
    const { slug } = await props.params;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        href: route("/orgs/[slug]/d4h-nag", { slug }),
                        label: "D4H Attendance Reminders",
                    },
                ]}
            />
            <Std.ScrollContainer>
                <Std.IndexPage title="D4H Attendance Reminders">
                    <p className="text-sm text-muted-foreground">Coming soon.</p>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </>
    );
}
