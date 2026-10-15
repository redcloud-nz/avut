/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { MutationButton } from "@/components/ui/button";
import { trpc } from "@/trpc/client";

/**
 * App-wide banner shown whenever the current session is an admin impersonating another
 * user. Better Auth marks such a session with `session.session.impersonatedBy`.
 *
 * Renders `null` (no layout footprint at all) for every normal session. When impersonating
 * it pins an amber warning bar to the top of the viewport naming the impersonated user,
 * with a "Stop impersonating" action that calls `authClient.admin.stopImpersonating()` —
 * the reverse of the Phase 9 impersonate dialog — then drops the whole query cache (the
 * browser-singleton client still holds results fetched as the impersonated user) and
 * returns the operator to the system-admin user list. `router.refresh()` is required
 * because the RSC payload on screen was rendered as the impersonated user.
 *
 * Rendered inside the authenticated layout's `HydrateClient`, below its awaited `getSession`
 * fetch, so this reads the hydrated session. Rendered any higher, its query ran over HTTP during
 * server rendering without the request's cookie, cached `null`, and made every session read below
 * it render as signed out on the server (#347).
 *
 * The bar is `fixed` to the top of the viewport. While it's in the DOM, `globals.css` sets
 * `--impersonation-h` to its height, which pushes the sidebar and `Std.SidebarInset` down (#87).
 */
export function ImpersonationBanner() {
    const { data } = useSuspenseQuery(trpc.user.getSession.queryOptions());

    const impersonatedBy = data?.session?.impersonatedBy;
    const user = data?.user;

    const mutation = useMutation({
        mutationFn: async () => {
            const { error } = await authClient.admin.stopImpersonating();
            if (error) throw new Error(error.message ?? "Failed to stop impersonating");
        },
        onError(error: unknown) {
            console.error("Failed to stop impersonating:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Failed to stop impersonating: ${message}`);
        },
        onSuccess() {
            // Identity switch back to the admin: a full page load drops the impersonated
            // user's cached results without letting mounted queries refetch first (see
            // `impersonate-user-dialog.tsx`).
            // `replace`, not `assign`: Back shouldn't return to a page rendered as the other identity.
            window.location.replace("/system/admin/users");
        },
    });

    // This banner lives in the persistent (authenticated) layout and never unmounts, so a
    // previous "Stopped" success state would otherwise carry into the next impersonation
    // session and leave the button stuck. Reset whenever the impersonation identity changes.
    useEffect(() => {
        mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on the identity transition only
    }, [impersonatedBy]);

    if (!impersonatedBy || !user) return null;

    const label = user.name || user.email || "another user";

    return (
        <div
            role="alert"
            data-slot="impersonation-banner"
            className="fixed inset-x-0 top-0 z-50 flex h-9 items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
            <TriangleAlertIcon className="size-4 shrink-0" />
            <span className="flex-1">
                You are impersonating <span className="font-medium">{label}</span>
                {user.email ? ` (${user.email})` : ""}. The app is shown exactly as they see it.
            </span>
            <MutationButton
                type="button"
                size="xs"
                variant="outline"
                status={mutation.status}
                text={{
                    idle: "Stop impersonating",
                    pending: "Stopping",
                    success: "Stopped",
                }}
                onClick={() => mutation.mutate()}
                aria-label={`Stop impersonating ${label}`}
            />
        </div>
    );
}
