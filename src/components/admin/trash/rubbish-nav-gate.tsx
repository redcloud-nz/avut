/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

import { useHasPermission } from "@/hooks/use-has-permission";

/**
 * Shows `children` for a caller who can delete a Person *or* a Team — either is enough to reach
 * the Rubbish screen, since `trash-router`'s `listTrash` already shows only the entity types the
 * caller has `delete` permission on. `<Protect>` only expresses an AND across resources, so this
 * combines two `useHasPermission` checks directly instead.
 */
export function RubbishNavGate({ children }: { children: ReactNode }) {
    const canDeletePerson = useHasPermission({ person: ["delete"] });
    const canDeleteTeam = useHasPermission({ team: ["delete"] });

    return canDeletePerson || canDeleteTeam ? children : null;
}
