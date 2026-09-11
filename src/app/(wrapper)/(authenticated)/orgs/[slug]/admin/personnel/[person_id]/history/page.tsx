/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]/history
 */
"use client";

import { use } from "react";

import { Std } from "@/components/blocks/std";
import { NotImplemented } from "@/components/nav/errors";

import { usePerson } from "@/hooks/use-person";
import { route } from "@/lib/routes";

export default function AdminModule_PersonHistory_Page(
    props: PageProps<`/orgs/[slug]/admin/personnel/[person_id]/history`>,
) {
    const { slug, person_id } = use(props.params);
    //const organization = useOrganization();

    const person = usePerson(person_id);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Personnel", href: route("/orgs/[slug]/admin/personnel", { slug }) },
                    {
                        label: person.name,
                        href: route("/orgs/[slug]/admin/personnel/[person_id]", {
                            slug,
                            person_id,
                        }),
                    },
                    "History",
                ]}
            />
            <Std.ScrollContainer>
                <NotImplemented />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
