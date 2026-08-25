/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate, write } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `personnel` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * Kept next to the mutations they cover rather than duplicated at each call site, since several
 * personnel actions (link/unlink in particular) touch queries owned by other routers.
 */
export const personnelEffects = createEffects<"personnel">()({
    archivePerson: (vars, { updated }) => [
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
    createPerson: (vars) => [
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(
            trpc.personnel.listUnlinkedPersonnel.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deletePerson: (vars) => [
        invalidate(
            trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    restorePerson: (vars, { updated }) => [
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
    updatePerson: (vars, { updated }) => [
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
});
