/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { useSignOut } from "@/client/use-sign-out";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { formatRelativeDateTime } from "@/lib/datetime";
import { trpc } from "@/trpc/client";
import { getQueryClient } from "@/trpc/query-client";

/**
 * What a closed account sees after signing in. Restoring is offered only to an account its owner
 * closed; one a system administrator deleted is told to contact them.
 */
export function AccountClosed_Content({
    email,
    canRestore,
    purgeAt,
}: {
    email: string;
    canRestore: boolean;
    purgeAt: string | null;
}) {
    const router = useRouter();
    const signOut = useSignOut();

    const mutation = useMutation(
        trpc.user.restoreMyAccount.mutationOptions({
            onError(error) {
                toast.error(`Couldn't restore your account: ${error.message}`);
            },
            async onSuccess() {
                // The session cookie cache still says `Deleted` for up to its 5-minute window;
                // refetch past it so the app lets the restored account straight back in.
                await authClient.getSession({ query: { disableCookieCache: true } });
                getQueryClient().clear();
                toast.success("Welcome back — your account has been restored.");
                router.replace("/auth/post-sign-in");
                router.refresh();
            },
        }),
    );

    const when = purgeAt ? formatRelativeDateTime(purgeAt) : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>This account is closed</CardTitle>
                <CardDescription>{email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {canRestore ? (
                    <p>
                        You closed this account. You can restore it now and carry on where you left
                        off — your organisation memberships come back with it.
                    </p>
                ) : (
                    <p>
                        A system administrator deleted this account. Contact them if you think it
                        should be restored.
                    </p>
                )}
                {when && (
                    <p className="text-muted-foreground">It will be permanently deleted {when}.</p>
                )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => void signOut()}>
                    Sign out
                </Button>
                {canRestore && (
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Restore account",
                            pending: "Restoring",
                            success: "Restored",
                        }}
                        onClick={() => mutation.mutate()}
                    />
                )}
            </CardFooter>
        </Card>
    );
}
