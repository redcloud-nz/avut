/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_PersonHistory_Content({ personId }: { personId: PersonId }) {
    const organization = useOrganization();

    const { data: person } = useSuspenseQuery(
        trpc.personnel.getPerson.queryOptions({ organizationId: organization.id, personId }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Personnel",
                        href: route("/orgs/[slug]/admin/personnel", { slug: organization.slug }),
                    },
                    {
                        label: person.name,
                        href: route("/orgs/[slug]/admin/personnel/[person_id]", {
                            slug: organization.slug,
                            person_id: personId,
                        }),
                    },
                    "History",
                ]}
                actions={<HelpButton slug="admin" />}
            />
            <Std.ScrollContainer>
                <ObjectHistory
                    objectType="Person"
                    objectId={personId}
                    title={`${person.name} — History`}
                />
            </Std.ScrollContainer>
        </>
    );
}
