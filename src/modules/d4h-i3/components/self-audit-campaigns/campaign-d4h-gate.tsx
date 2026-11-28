/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { useQueryClient } from "@tanstack/react-query";

import { trpcErrorCode } from "@/components/errors/describe-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DialogBody, DialogCloseButton, DialogFooter } from "@/components/ui/dialog";
import { useOrganization } from "@/hooks/use-organization";

/**
 * For a dialog body (or, with `fallback`, a page section) that reads D4H with the caller's
 * personal D4H token: a procedure that needs it is PRECONDITION_FAILED when the organization has
 * D4H off or the caller has no token here. That one case gets `fallback` in place of `children`,
 * by default {@link D4HI3Module_SelfAuditCampaign_NoD4H} for a dialog; anything else goes on to
 * the boundary above (the `DialogBoundary`, or the route's error page: a fallback that throws
 * hands the error up).
 *
 * The failed read stays cached, and a suspense query mounting on a cached error rethrows it rather
 * than refetching. So when the fallback goes (the dialog closes, the page is left), the queries
 * that failed this way are dropped: after adding a token, coming back reads D4H afresh.
 */
export function D4HI3Module_SelfAuditCampaign_D4HGate({
    children,
    fallback = <D4HI3Module_SelfAuditCampaign_NoD4H />,
}: {
    children: ReactNode;
    fallback?: ReactNode;
}) {
    return (
        <ErrorBoundary
            fallbackRender={({ error }) => {
                if (trpcErrorCode(error) !== "PRECONDITION_FAILED") throw error;
                return <NoD4HFallback>{fallback}</NoD4HFallback>;
            }}
        >
            {children}
        </ErrorBoundary>
    );
}

/** The gate's fallback: drops the queries that failed for want of a token when it unmounts. */
function NoD4HFallback({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    useEffect(
        () => () => {
            queryClient.removeQueries({
                predicate: (query) =>
                    query.state.status === "error" &&
                    trpcErrorCode(query.state.error) === "PRECONDITION_FAILED",
            });
        },
        [queryClient],
    );
    return children;
}

/** A dialog's body and footer saying why it can't reach D4H, and where to add a token. */
export function D4HI3Module_SelfAuditCampaign_NoD4H() {
    return (
        <>
            <DialogBody>
                <D4HI3Module_SelfAuditCampaign_NoD4HAlert />
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Close</DialogCloseButton>
            </DialogFooter>
        </>
    );
}

/** Why a self audit campaign can't reach D4H, and where to add a token: in a dialog or on a page. */
export function D4HI3Module_SelfAuditCampaign_NoD4HAlert() {
    const organization = useOrganization();
    const d4hEnabled = organization.settings.integrations.d4h.enabled !== false;

    return (
        <Alert variant="warning">
            <AlertTitle>
                {d4hEnabled ? "Needs your personal D4H token" : "D4H isn't connected"}
            </AlertTitle>
            <AlertDescription>
                {d4hEnabled ? (
                    <p>
                        A self audit campaign reads its team and each member&rsquo;s equipment from
                        D4H with your own token. Add one in{" "}
                        <Link href="/user/settings/d4h" className="underline underline-offset-4">
                            User Settings › D4H
                        </Link>
                        .
                    </p>
                ) : (
                    <p>
                        This organisation doesn&rsquo;t have the D4H integration enabled, so
                        there&rsquo;s no team to send a self audit campaign to.
                    </p>
                )}
            </AlertDescription>
        </Alert>
    );
}
