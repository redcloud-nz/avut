/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hNagEffects } from "@/client/d4h-nag-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ObjectName } from "@/components/ui/typography";
import { useLogger } from "@/hooks/use-logger";
import { trpc } from "@/trpc/client";

/**
 * The page a reminder email's opt-out link opens: who the reminders go to and whether they've
 * opted out, with one button to switch. Works signed out or in; the token is the only access.
 *
 * @param token The link token from the email. Never logged.
 */
export function OptOut_Card({ token }: { token: string }) {
    const logger = useLogger("D4HNag", "OptOutCard");

    const { data } = useSuspenseQuery(trpc.d4hNag.getOptOutByToken.queryOptions({ token }));

    const mutation = useMutation(
        trpc.d4hNag.setOptOutByToken.mutationOptions({
            meta: { effects: d4hNagEffects.setOptOutByToken },
            onError(error) {
                logger.error("Failed to change attendance reminder opt-out", error.message);
                toast.error(`Couldn't save your choice: ${error.message}`);
            },
            onSuccess(result) {
                if (result.state === "ok")
                    toast.success(
                        result.optedOut
                            ? "You won't get these reminders any more"
                            : "You'll get these reminders again",
                    );
            },
        }),
    );

    if (data.state === "not-found") return <OptOutLinkInvalid_Card />;

    const { organizationName, teamName, memberName, optedOut } = data;
    const team = (
        <>
            <ObjectName>{teamName}</ObjectName> (<ObjectName>{organizationName}</ObjectName>)
        </>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Attendance reminders</CardTitle>
                <CardDescription>
                    {optedOut ? (
                        <>You&apos;ve opted out of attendance reminders for {team}.</>
                    ) : (
                        <>You&apos;re getting attendance reminders for {team}.</>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                Sent to <span className="text-foreground">{memberName}</span>
            </CardContent>
            <CardFooter>
                <MutationButton
                    type="button"
                    variant={optedOut ? "default" : "outline"}
                    // The label follows the state the mutation writes back, so the button stays
                    // usable after a success rather than locking on "Saved".
                    status={mutation.status === "success" ? "idle" : mutation.status}
                    text={
                        optedOut
                            ? {
                                  idle: "Send me these reminders again",
                                  pending: "Saving",
                                  success: "Saved",
                              }
                            : {
                                  idle: "Stop sending me these reminders",
                                  pending: "Saving",
                                  success: "Saved",
                              }
                    }
                    onClick={() => mutation.mutate({ token, optedOut: !optedOut })}
                />
            </CardFooter>
        </Card>
    );
}

/** Shown for a link token that doesn't match a reminder (unknown, or purged). */
export function OptOutLinkInvalid_Card() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>This link isn&apos;t valid any more</CardTitle>
                <CardDescription>
                    Use the link in a more recent reminder email, or ask your organisation to change
                    your reminder settings.
                </CardDescription>
            </CardHeader>
        </Card>
    );
}
