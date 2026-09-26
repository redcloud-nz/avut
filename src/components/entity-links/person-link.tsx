/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";

import { EntityLink } from "./entity-link";

export type PersonLinkProps = {
    person: Pick<PersonData, "id" | "name"> & Partial<Pick<PersonData, "email">>;
};

export function PersonLink({ person }: PersonLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/admin/personnel/[person_id]", {
                slug: organization.slug,
                person_id: person.id,
            })}
            title={person.name}
            type="Person"
        >
            {person.email && <span className="text-muted-foreground">{person.email}</span>}
        </EntityLink>
    );
}
