/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ReactNode } from "react";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

/**
 * Renders `children` only when the Notes module is usable in the current organization (its
 * `notes-module` flag is on for this deployment and the org has the module enabled), and throws
 * `NotEnabledError` otherwise.
 */
export function Notes_ModuleGate({ children }: { children: ReactNode }) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("notes")) {
        throw new NotEnabledError("The Notes module is not enabled for this organization.");
    }

    return children;
}
