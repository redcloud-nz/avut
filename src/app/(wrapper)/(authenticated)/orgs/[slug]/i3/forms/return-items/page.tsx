/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /i3/[slug]/forms/return-items
 */

"use client";

import { Std } from "@/components/blocks/std";
import { UnderConstruction } from "@/components/under-construction";
import { route } from "@/lib/routes";
import { useOrganization } from "@/hooks/use-organization";

export default function I3_Return_Page() {
    const organization = useOrganization();

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "I3", href: route("/orgs/[slug]/i3", { slug: organization.slug }) },
                    { label: "Forms" },
                    { label: "Return Items" },
                ]}
            />
            <Std.ScrollContainer>
                <UnderConstruction />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
