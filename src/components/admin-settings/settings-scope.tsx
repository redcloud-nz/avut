/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { createContext, use, type ReactNode } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";

/**
 * Which tRPC surface the organization-settings cards should read and write through.
 *
 * - `"organization"` — `settings.*`, gated by the caller's `organization:update` permission in
 *   the organization they are currently in. The default.
 * - `"system-admin"` — `systemAdmin.*`, gated by the session's site-wide `admin` role and usable
 *   against an organization the caller is not a member of.
 *
 * The two procedures take the same input (`{ organizationId, settings }`) and return the same
 * `OrganizationSettings`, so the cards themselves are identical in both scopes — only the
 * procedure they target and the query they invalidate differ.
 */
export type OrganizationSettingsScope = "organization" | "system-admin";

const ScopeContext = createContext<OrganizationSettingsScope>("organization");

export function OrganizationSettingsScopeProvider({
    scope,
    children,
}: {
    scope: OrganizationSettingsScope;
    children: ReactNode;
}) {
    return <ScopeContext value={scope}>{children}</ScopeContext>;
}

export function useOrganizationSettingsScope() {
    return use(ScopeContext);
}

/**
 * The save mutation shared by every organization-settings card, routed to whichever scope the
 * surrounding page declared.
 *
 * `onSaved` receives the settings as they stand after the write, for the card to `form.reset(...)`
 * its own slice from.
 */
export function useOrganizationSettingsMutation({
    organizationId,
    errorMessage,
    onSaved,
}: {
    organizationId: OrganizationId;
    /** Prefix for the error toast, e.g. `"Failed to update email integration settings"`. */
    errorMessage: string;
    onSaved: (updated: OrganizationSettings) => void;
}) {
    const scope = useOrganizationSettingsScope();
    const queryClient = useQueryClient();

    const queryFilter =
        scope === "system-admin"
            ? trpc.systemAdmin.getOrganizationSettings.queryFilter({ organizationId })
            : trpc.settings.getOrganizationSettings.queryFilter({ organizationId });

    const handlers = {
        onError(error: { message: string }) {
            toast.error(`${errorMessage}: ${error.message}`);
            mutation.reset();
        },
        async onSuccess(updated: OrganizationSettings) {
            await queryClient.invalidateQueries(queryFilter);
            if (scope === "system-admin") {
                // `enabledModules` on the system-admin org views is derived from the same
                // config rows, so a settings save leaves those screens stale otherwise.
                await Promise.all([
                    queryClient.invalidateQueries(
                        trpc.systemAdmin.getOrganization.queryFilter({ organizationId }),
                    ),
                    queryClient.invalidateQueries(trpc.systemAdmin.listOrganizations.queryFilter()),
                ]);
            }
            onSaved(updated);
            setTimeout(() => mutation.reset(), 1500);
        },
    };

    const mutation = useMutation(
        scope === "system-admin"
            ? trpc.systemAdmin.updateOrganizationSettings.mutationOptions(handlers)
            : trpc.settings.updateOrganizationSettings.mutationOptions(handlers),
    );

    return mutation;
}
