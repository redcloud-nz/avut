/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache invalidations for `personnel` router mutations, keyed by procedure name.
 *
 * Passed as `meta.invalidates` on the corresponding `useMutation` call — see
 * `MutationInvalidator`. Kept next to the mutations they cover rather than duplicated at each
 * call site, since several personnel actions (link/unlink in particular) touch queries owned by
 * other routers.
 */
export const personnelInvalidations = {
    archivePerson: (vars: RouterInput["personnel"]["archivePerson"]) => [
        trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
    ],
    createPerson: (vars: RouterInput["personnel"]["createPerson"]) => [
        trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        trpc.personnel.listUnlinkedPersonnel.queryFilter({ organizationId: vars.organizationId }),
    ],
    deletePerson: (vars: RouterInput["personnel"]["deletePerson"]) => [
        trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
    ],
    restorePerson: (vars: RouterInput["personnel"]["restorePerson"]) => [
        trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
    ],
    updatePerson: (vars: RouterInput["personnel"]["updatePerson"]) => [
        trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
    ],
};

/**
 * Direct cache writes for `personnel` router mutations, keyed by procedure name.
 *
 * Passed as `meta.writes` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * Covers single-entity detail queries the mutation's response fully determines the new value of
 * (`getPerson`); list-level effects still belong in `personnelInvalidations`.
 */
export const personnelWrites = {
    archivePerson: (
        vars: RouterInput["personnel"]["archivePerson"],
        { updated }: RouterOutput["personnel"]["archivePerson"],
    ) => [
        {
            queryKey: trpc.personnel.getPerson.queryKey({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
            data: updated,
        },
    ],
    restorePerson: (
        vars: RouterInput["personnel"]["restorePerson"],
        { updated }: RouterOutput["personnel"]["restorePerson"],
    ) => [
        {
            queryKey: trpc.personnel.getPerson.queryKey({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
            data: updated,
        },
    ],
    updatePerson: (
        vars: RouterInput["personnel"]["updatePerson"],
        { updated }: RouterOutput["personnel"]["updatePerson"],
    ) => [
        {
            queryKey: trpc.personnel.getPerson.queryKey({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
            data: updated,
        },
    ],
};
