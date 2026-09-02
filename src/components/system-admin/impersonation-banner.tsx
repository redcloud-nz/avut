/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";
import { authClient } from "@/client/auth-client";
import { MutationButton } from "@/components/ui/button";

import { getQueryClient } from "@/trpc/query-client";

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
 * Layout — KNOWN LIMITATION: the bar is `fixed` at the top of the viewport (`h-9`, `z-50`)
 * and overlaps the top ~36px of the app-shell navbar and the `fixed` sidebar header. The
 * global `<SidebarProvider>` wrapper is a `min-h-svh` flex ROW and the sidebar is
 * `fixed inset-y-0`, so no in-flow spacer here can push either down. A proper fix needs an
 * `--impersonation-h` offset threaded through `Std.SidebarInset` / `src/components/ui/sidebar.tsx`;
 * tracked as a follow-up. Impersonation is a transient, admin-only state, so this ships as-is.
 */
export function ImpersonationBanner() {
    const router = useRouter();
    const { data } = useSession();

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
            getQueryClient().clear();
            router.push("/system-admin/users");
            router.refresh();
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
