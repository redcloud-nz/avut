/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";

import { authClient } from "@/client/auth-client";
import { useSession } from "@/client/auth-queries";
import { useSignOut } from "@/client/use-sign-out";
import { Alert } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
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

const SESSIONS_QUERY_KEY = ["user", "sessions"];

export function ActiveSessions_Card() {
    const { data: currentSession } = useSession();
    const currentToken = currentSession?.session.token;

    const sessionsQuery = useQuery({
        queryKey: SESSIONS_QUERY_KEY,
        queryFn: () => authClient.listSessions({}, { throw: true }),
        retry: false,
    });

    // Better Auth guards `/list-sessions` with a freshness check — a session older than
    // `session.freshAge` (default 24h) gets a 403 until the user re-authenticates.
    const isStale =
        sessionsQuery.error instanceof Error && /fresh/i.test(sessionsQuery.error.message);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
                {sessionsQuery.isPending && (
                    <div className="p-4">
                        <RainbowSpinner className="mx-auto" />
                    </div>
                )}
                {sessionsQuery.isError &&
                    (isStale ? (
                        <Alert variant="warning">
                            For your security, sign in again to view and manage your active
                            sessions.
                        </Alert>
                    ) : (
                        <Alert variant="error">
                            Failed to load active sessions: {sessionsQuery.error.message}
                        </Alert>
                    ))}
                {sessionsQuery.data
                    ?.slice()
                    .sort((a, b) => {
                        if (a.token === currentToken) return -1;
                        if (b.token === currentToken) return 1;
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map((session) => (
                        <ActiveSession
                            key={session.id}
                            session={session}
                            isCurrent={session.token === currentToken}
                        />
                    ))}
            </CardContent>
        </Card>
    );
}

type SessionRow = {
    id: string;
    token: string;
    userAgent?: string | null;
    createdAt: Date | string;
};

function ActiveSession({ session, isCurrent }: { session: SessionRow; isCurrent: boolean }) {
    const logger = useLogger("Common", "ActiveSessions_Card");
    const queryClient = useQueryClient();
    const signOut = useSignOut();

    const [confirmOpen, setConfirmOpen] = useState(false);

    const { browser, os, isMobile } = parseUserAgent(session.userAgent);
    const DeviceIcon = isMobile ? SmartphoneIcon : MonitorIcon;

    const revokeMutation = useMutation({
        async mutationFn() {
            const { error } = await authClient.revokeSession({ token: session.token });
            if (error) throw new Error(error.message ?? "Failed to revoke session");
        },
        onError(error: Error) {
            logger.error("Failed to revoke session", error);
            toast.error(`Failed to revoke session: ${error.message}`);
        },
        async onSuccess() {
            await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
            setConfirmOpen(false);
            toast.success("Session revoked");
        },
    });

    const signOutMutation = useMutation({
        mutationFn: () => signOut(),
    });

    return (
        <Item>
            <ItemMedia>
                <DeviceIcon />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>
                    {browser}
                    {os ? ` · ${os}` : ""}
                </ItemTitle>
                <ItemDescription>
                    {isCurrent ? (
                        <Badge variant="secondary">Current session</Badge>
                    ) : (
                        `Signed in ${timeAgo(session.createdAt)}`
                    )}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                {isCurrent ? (
                    <MutationButton
                        variant="outline"
                        status={signOutMutation.status}
                        text={{ idle: "Sign out", pending: "Signing out", success: "Signing out" }}
                        onClick={() => signOutMutation.mutate()}
                    />
                ) : (
                    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Revoke</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Revoke session</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This signs out the device using this session. It will need to
                                    sign in again. This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <MutationButton
                                    variant="destructive"
                                    status={revokeMutation.status}
                                    text={{
                                        idle: "Revoke",
                                        pending: "Revoking",
                                        success: "Revoked",
                                    }}
                                    onClick={() => revokeMutation.mutate()}
                                />
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </ItemActions>
        </Item>
    );
}

/** Minimal user-agent sniff — browser name, OS, and a rough desktop/mobile split. */
function parseUserAgent(ua?: string | null): { browser: string; os: string; isMobile: boolean } {
    if (!ua) return { browser: "Unknown device", os: "", isMobile: false };

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

    const browser = /Edg\//.test(ua)
        ? "Edge"
        : /OPR\/|Opera/.test(ua)
          ? "Opera"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : "Unknown browser";

    const os = /Windows/.test(ua)
        ? "Windows"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Mac OS X/.test(ua)
            ? "macOS"
            : /Android/.test(ua)
              ? "Android"
              : /Linux/.test(ua)
                ? "Linux"
                : "";

    return { browser, os, isMobile };
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const TIME_DIVISIONS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.34524],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
];

function timeAgo(date: Date | string): string {
    let duration = (new Date(date).getTime() - Date.now()) / 1000;
    for (const [unit, amount] of TIME_DIVISIONS) {
        if (Math.abs(duration) < amount) return RELATIVE_TIME.format(Math.round(duration), unit);
        duration /= amount;
    }
    return "";
}
