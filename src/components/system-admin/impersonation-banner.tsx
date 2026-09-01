/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
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
 * Layout: the bar itself is `fixed` (out of normal flow) so the `h-svh` app shell and its
 * `fixed` sidebar still own the full viewport; a sibling `h-9` spacer — rendered only while
 * impersonating — reserves the matching strip so shell content starts below the bar.
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

    if (!impersonatedBy || !user) return null;

    const label = user.name || user.email || "another user";

    return (
        <>
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
            <div className="h-9" aria-hidden />
        </>
    );
}
