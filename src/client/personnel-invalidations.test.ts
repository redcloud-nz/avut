/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";

import { personnelInvalidations } from "./personnel-invalidations";

describe("personnelInvalidations", () => {
    const organizationId = OrganizationId.create();
    const personId = PersonId.create();

    it("createPerson invalidates the personnel list and the unlinked-personnel list", () => {
        const filters = personnelInvalidations.createPerson({
            organizationId,
            personId,
            create: {},
        } as never);

        expect(filters.map((f) => f.queryKey)).toEqual([
            [["personnel", "listPersonnel"], { input: { organizationId }, type: "query" }],
            [["personnel", "listUnlinkedPersonnel"], { input: { organizationId }, type: "query" }],
        ]);
    });

    it("updatePerson, deletePerson, archivePerson, and restorePerson each invalidate only the personnel list", () => {
        const vars = { organizationId, personId };
        const expected = [
            [["personnel", "listPersonnel"], { input: { organizationId }, type: "query" }],
        ];

        expect(
            personnelInvalidations
                .updatePerson({ ...vars, update: {} } as never)
                .map((f) => f.queryKey),
        ).toEqual(expected);
        expect(personnelInvalidations.deletePerson(vars as never).map((f) => f.queryKey)).toEqual(
            expected,
        );
        expect(personnelInvalidations.archivePerson(vars as never).map((f) => f.queryKey)).toEqual(
            expected,
        );
        expect(personnelInvalidations.restorePerson(vars as never).map((f) => f.queryKey)).toEqual(
            expected,
        );
    });
});
