/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/personnel/[person_id]/history
 */
"use client";

import { use } from "react";

import { Lexington } from "@/components/blocks/lexington";
import { NotImplemented } from "@/components/nav/errors";

import { useOrganization } from "@/hooks/use-organization";
import { usePerson } from "@/hooks/use-person";
import * as Paths from "@/paths";

export default function AdminModule_PersonHistory_Page(
    props: PageProps<`/main/[slug]/admin/personnel/[person_id]/history`>,
) {
    const { slug, person_id } = use(props.params);
    const organization = useOrganization();

    const person = usePerson(person_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.personnel,
                    {
                        href: Paths.main(slug).admin.person(person_id).index.href,
                        label: person.name,
                    },
                    "History",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg" className="h-full flex flex-col justify-center">
                    <NotImplemented />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
