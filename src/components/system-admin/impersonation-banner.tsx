/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";
import { authClient } from "@/client/auth-client";
import { MutationButton } from "@/components/ui/button";

import { authQueryKeys } from "@/lib/auth-query-keys";

/**
 * App-wide banner shown whenever the current session is an admin impersonating another
 * user. Better Auth marks such a session with `session.session.impersonatedBy`.
 *
 * Renders `null` (no layout footprint) for every normal session. When impersonating it
 * pins a warning bar to the top of the viewport naming the impersonated user, with a
 * "Stop impersonating" action that calls `authClient.admin.stopImpersonating()` — the
 * reverse of the Phase 9 impersonate dialog — then drops the stale session cache and
 * returns the operator to the system-admin user list. `router.refresh()` is required
 * because the RSC payload on screen was rendered as the impersonated user.
 */
export function ImpersonationBanner() {
    const router = useRouter();
    const queryClient = useQueryClient();
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
        async onSuccess() {
            await queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
            router.push("/system-admin/users");
            router.refresh();
        },
    });

    if (!impersonatedBy || !user) return null;

    const label = user.name || user.email || "another user";

    return (
        <div
            role="alert"
            className="sticky top-0 z-50 flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
            <TriangleAlertIcon className="size-4 shrink-0" />
            <span className="flex-1">
                You are impersonating <span className="font-medium">{user.name}</span>
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
