/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { RubbishNavGate } from "@/components/admin/trash/rubbish-nav-gate";
import { NavSubItem } from "@/components/nav/nav-section";
import { Protect } from "@/components/protect";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

/** Nested pages for the Admin module's `NavCollapsible` section — not a standalone sidebar group. */
export function Admin_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <>
            <Protect permissions={{ invitation: ["view"] }}>
                <NavSubItem
                    label="Invitations"
                    href={route("/orgs/[slug]/admin/invitations", { slug })}
                />
            </Protect>
            <NavSubItem
                label="Organisation"
                href={route("/orgs/[slug]/admin/organization", { slug })}
            />
            <Protect permissions={{ person: ["view"] }}>
                <NavSubItem
                    label="Personnel"
                    href={route("/orgs/[slug]/admin/personnel", { slug })}
                />
            </Protect>
            <RubbishNavGate>
                <NavSubItem
                    label="Rubbish"
                    href={route("/orgs/[slug]/admin/rubbish-bin", { slug })}
                />
            </RubbishNavGate>
            <Protect permissions={{ team: ["view"] }}>
                <NavSubItem label="Teams" href={route("/orgs/[slug]/admin/teams", { slug })} />
            </Protect>
            <Protect permissions={{ member: ["view"] }}>
                <NavSubItem label="Users" href={route("/orgs/[slug]/admin/users", { slug })} />
            </Protect>
        </>
    );
}
