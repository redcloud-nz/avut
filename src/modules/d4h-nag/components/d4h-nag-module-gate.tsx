/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ReactNode } from "react";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

/**
 * Renders `children` only when the D4H Attendance Reminders module is usable in the current
 * organization (its `d4h-nag-module` flag is on for this deployment, and the org has the module
 * and the D4H module it requires enabled), and throws `NotEnabledError` otherwise.
 */
export function D4HNag_ModuleGate({ children }: { children: ReactNode }) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("d4h-nag")) {
        throw new NotEnabledError(
            "The D4H Attendance Reminders module is not enabled for this organization. It needs the D4H module turned on too.",
        );
    }

    return children;
}
