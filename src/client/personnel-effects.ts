/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { invalidate, write } from "@/trpc/mutation-invalidator";
import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache effects for `personnel` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * Kept next to the mutations they cover rather than duplicated at each call site, since several
 * personnel actions (link/unlink in particular) touch queries owned by other routers.
 */
export const personnelEffects = {
    archivePerson: (
        vars: RouterInput["personnel"]["archivePerson"],
        { updated }: RouterOutput["personnel"]["archivePerson"],
    ) => [
        write(
            trpc.personnel.getPerson.queryKey({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
            updated,
        ),
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    createPerson: (vars: RouterInput["personnel"]["createPerson"]) => [
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(
            trpc.personnel.listUnlinkedPersonnel.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deletePerson: (vars: RouterInput["personnel"]["deletePerson"]) => [
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    restorePerson: (
        vars: RouterInput["personnel"]["restorePerson"],
        { updated }: RouterOutput["personnel"]["restorePerson"],
    ) => [
        write(
            trpc.personnel.getPerson.queryKey({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
            updated,
        ),
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    updatePerson: (
        vars: RouterInput["personnel"]["updatePerson"],
        { updated }: RouterOutput["personnel"]["updatePerson"],
    ) => [
        write(
            trpc.personnel.getPerson.queryKey({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
            updated,
        ),
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
};
