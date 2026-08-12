/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput } from "@/trpc/routers/_app";

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
        trpc.personnel.getPerson.queryFilter({
            organizationId: vars.organizationId,
            personId: vars.personId,
        }),
        trpc.personnel.listPersonnel.queryFilter({ organizationId: vars.organizationId }),
    ],
};
