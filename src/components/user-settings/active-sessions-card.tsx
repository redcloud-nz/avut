/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";

import { useSignOut } from "@/client/use-sign-out";
import { usersEffects } from "@/client/users-effects";
import { Alert } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { RainbowSpinner } from "@/components/ui/loading";
import { useLogger } from "@/hooks/use-logger";
import { formatRelativeDateTime } from "@/lib/datetime";
import { UserSessionData, UserSessionId } from "@/lib/schemas/user-session";
import { trpc } from "@/trpc/client";

export function ActiveSessions_Card() {
    const logger = useLogger("Common", "ActiveSessions_Card");
    const sessionsQuery = useQuery(trpc.users.listSessions.queryOptions());

    // The session awaiting revoke confirmation. Held here rather than in the row so that
    // invalidating the list on success can't unmount an open dialog mid-close.
    const [pendingRevoke, setPendingRevoke] = useState<UserSessionData | null>(null);

    // The session row is deleted immediately, but `session.cookieCache` (5 minutes, see
    // `auth.ts`) means the revoked device can keep rendering as signed-in until its cached
    // session cookie expires. Anything that re-reads the session server-side rejects it at
    // once, so this is a display lag rather than retained access — but the dialog copy
    // promises "a few minutes" rather than immediacy because of it.
    const revokeMutation = useMutation(
        trpc.users.revokeSession.mutationOptions({
            meta: { effects: usersEffects.revokeSession },
            onError(error) {
                logger.error("Failed to revoke session", error);
                toast.error(`Failed to revoke session: ${error.message}`);
            },
            onSuccess() {
                setPendingRevoke(null);
                toast.success("Session revoked.");
            },
        }),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
                {sessionsQuery.isPending ? (
                    <div className="p-4">
                        <RainbowSpinner className="mx-auto" />
                    </div>
                ) : sessionsQuery.isError ? (
                    <Alert variant="error">
                        Failed to load active sessions: {sessionsQuery.error.message}
                    </Alert>
                ) : (
                    sortCurrentFirst(sessionsQuery.data).map((session) => (
                        <ActiveSession_Item
                            key={session.id}
                            session={session}
                            onRevoke={() => setPendingRevoke(session)}
                        />
                    ))
                )}
            </CardContent>

            <AlertDialog
                open={pendingRevoke !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingRevoke(null);
                        revokeMutation.reset();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ends this session
                            {pendingRevoke
                                ? ` (${describeDevice(pendingRevoke.userAgent)})`
                                : ""}{" "}
                            and signs that device out. It may take a few minutes to take full
                            effect. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <MutationButton
                            variant="destructive"
                            status={revokeMutation.status}
                            text={{ idle: "Revoke", pending: "Revoking", success: "Revoked" }}
                            onClick={() => {
                                if (pendingRevoke) {
                                    revokeMutation.mutate({
                                        sessionId: pendingRevoke.id as UserSessionId,
                                    });
                                }
                            }}
                        />
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

function ActiveSession_Item({
    session,
    onRevoke,
}: {
    session: UserSessionData;
    onRevoke: () => void;
}) {
    const signOut = useSignOut();
    const signOutMutation = useMutation({ mutationFn: () => signOut() });

    const { isMobile } = parseUserAgent(session.userAgent);
    const DeviceIcon = isMobile ? SmartphoneIcon : MonitorIcon;

    return (
        <Item>
            <ItemMedia>
                <DeviceIcon />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{describeDevice(session.userAgent)}</ItemTitle>
                <ItemDescription>
                    {session.isCurrent ? (
                        <Badge variant="secondary">Current session</Badge>
                    ) : (
                        `Signed in ${formatRelativeDateTime(session.createdAt)}`
                    )}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                {session.isCurrent ? (
                    <MutationButton
                        variant="outline"
                        status={signOutMutation.status}
                        text={{
                            idle: "Sign out",
                            pending: "Signing out",
                            success: "Signing out",
                        }}
                        onClick={() => signOutMutation.mutate()}
                    />
                ) : (
                    <Button variant="destructive" onClick={onRevoke}>
                        Revoke
                    </Button>
                )}
            </ItemActions>
        </Item>
    );
}

/** The current session first, then the rest newest-first. */
function sortCurrentFirst(sessions: readonly UserSessionData[]): UserSessionData[] {
    return sessions.toSorted((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
    });
}

function describeDevice(userAgent: string | null): string {
    const { browser, os } = parseUserAgent(userAgent);
    return os ? `${browser} · ${os}` : browser;
}

/**
 * Minimal user-agent sniff — browser name, OS, and a rough desktop/mobile split.
 *
 * Enough to help someone recognise their own devices in the list, which is all this card
 * needs; not worth a parsing dependency. Order matters: Edge and Opera both carry `Chrome/`
 * in their UA strings, and every Chromium browser carries `Safari/`.
 */
function parseUserAgent(userAgent: string | null): {
    browser: string;
    os: string;
    isMobile: boolean;
} {
    if (!userAgent) return { browser: "Unknown device", os: "", isMobile: false };

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);

    const browser = /Edg\//.test(userAgent)
        ? "Edge"
        : /OPR\/|Opera/.test(userAgent)
          ? "Opera"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : /Chrome\//.test(userAgent)
              ? "Chrome"
              : /Safari\//.test(userAgent)
                ? "Safari"
                : "Unknown browser";

    const os = /Windows/.test(userAgent)
        ? "Windows"
        : /iPhone|iPad|iPod/.test(userAgent)
          ? "iOS"
          : /Mac OS X/.test(userAgent)
            ? "macOS"
            : /Android/.test(userAgent)
              ? "Android"
              : /Linux/.test(userAgent)
                ? "Linux"
                : "";

    return { browser, os, isMobile };
}
