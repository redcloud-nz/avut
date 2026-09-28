/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode, useMemo } from "react";

import { useOrganization } from "@/hooks/use-organization";
import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { trashableEntityList } from "@/lib/trash-registry";

/**
 * Shows `children` for a caller who can delete at least one trashable entity type
 * (`src/lib/trash-registry.ts`) — that's all it takes to see something on the Rubbish screen,
 * since `trash-router`'s `listTrash` already filters rows per entity by the caller's own `delete`
 * permission. Driven by the registry rather than a fixed person/team check, so a new trashable
 * entity (e.g. Skill) needs no change here to be picked up by the nav link.
 */
export function RubbishNavGate({ children }: { children: ReactNode }) {
    const { roles } = useOrganization();

    const canDeleteAny = useMemo(
        () =>
            trashableEntityList.some((entity) =>
                hasAnyRoleWithPermissions(roles, { [entity.permission]: ["delete"] }),
            ),
        [roles],
    );

    return canDeleteAny ? children : null;
}
