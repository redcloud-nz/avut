/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useQueryState } from "nuqs";
import { type RefObject } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import {
    SESSION_CHECKS_POLL_MS,
    sessionChecksQueryOptions,
} from "@/components/skill-track/use-session-checks-sync";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { formatRelativeDateTime } from "@/lib/datetime";
import { getSkillCheckResultLabel, type SessionCheck } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { hasNames } from "@/lib/session-checks-sync";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const RECENT_CHECKS_ACTION = "recent-checks";

/** How many checks the dialog lists, newest first. */
const RECENT_CHECKS_LIMIT = 100;

/**
 * The `?action=recent-checks` param for the Recent checks dialog. `open()` pushes a history entry
 * (so Back closes the dialog), `close()` replaces it (so Back from the closed page doesn't reopen
 * it). Read raw, as in `useSessionConfigAction`: the page's other dialogs share `?action=`, and
 * `close()` only clears the param while it still names this dialog.
 */
export function useRecentChecksAction() {
    const [rawAction, setAction] = useQueryState("action");

    return {
        isOpen: rawAction === RECENT_CHECKS_ACTION,
        open: () => void setAction(RECENT_CHECKS_ACTION, { history: "push" }),
        close: () =>
            void setAction((current) => (current === RECENT_CHECKS_ACTION ? null : current), {
                history: "replace",
            }),
    };
}

/**
 * Lists a session's checks, newest first: the latest state of each check, not an event history.
 * A removed check shows as "Removed by …", muted. Driven by `?action=recent-checks`; mount it once
 * per page that can open it.
 *
 * While open it observes the session cache with its own 10 s poll, so it stays live for someone
 * who can open the page but isn't recording (whose page doesn't poll). For a recording assessor
 * it shares the page's query.
 *
 * Pass `returnFocusRef` when the trigger unmounts before the dialog opens (an item in a sheet):
 * the dialog then returns focus to that element on close.
 */
export function SkillTrack_SessionRecentChecksDialog({
    sessionId,
    returnFocusRef,
}: {
    sessionId: SkillCheckSessionId;
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const { isOpen, open, close } = useRecentChecksAction();

    return (
        <Dialog open={isOpen} onOpenChange={(next) => (next ? open() : close())}>
            <DialogContent
                size="lg"
                onCloseAutoFocus={
                    returnFocusRef
                        ? (event) => {
                              event.preventDefault();
                              returnFocusRef.current?.focus();
                          }
                        : undefined
                }
            >
                <DialogHeader>
                    <DialogTitle>Recent checks</DialogTitle>
                    <DialogDescription>
                        The latest state of each check in this session, newest first.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <SessionRecentChecks_Body sessionId={sessionId} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function SessionRecentChecks_Body({ sessionId }: { sessionId: SkillCheckSessionId }) {
    const organization = useOrganization();

    const { data: personSelf } = useSuspenseQuery(
        trpc.personnel.getPersonSelf.queryOptions({ organizationId: organization.id }),
    );

    // Mounted only while the dialog is open, so this polls only then. The options are the page
    // poll's (`sessionChecksQueryOptions`, same inputs), so the two observers share one query.
    const { data } = useSuspenseQuery({
        ...sessionChecksQueryOptions({
            organizationId: organization.id,
            sessionId,
            selfPersonId: personSelf?.id,
        }),
        refetchInterval: SESSION_CHECKS_POLL_MS,
    });

    const named = data.checks
        .filter(hasNames)
        .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    const shown = named.slice(0, RECENT_CHECKS_LIMIT);

    return (
        <>
            <DialogBody>
                {shown.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>No checks yet</EmptyTitle>
                            <EmptyDescription>
                                Checks recorded in this session will appear here.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
                        {shown.map((check) => (
                            <RecentCheckItem key={check.id} check={check} />
                        ))}
                    </ItemGroup>
                )}
                {named.length > RECENT_CHECKS_LIMIT && (
                    <p className="text-xs text-muted-foreground">
                        Showing the {RECENT_CHECKS_LIMIT} most recent of {named.length}.
                    </p>
                )}
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Close</DialogCloseButton>
            </DialogFooter>
        </>
    );
}

function RecentCheckItem({ check }: { check: SessionCheck }) {
    const organization = useOrganization();
    const removed = check.status === "Deleted";

    return (
        <Item role="listitem" size="sm" className={cn("px-0", removed && "text-muted-foreground")}>
            <ItemContent>
                <ItemTitle className={cn(removed && "text-muted-foreground")}>
                    {check.assesseeName} · {check.skillName}
                </ItemTitle>
                <ItemDescription>
                    {removed
                        ? `Removed by ${check.assessorName}`
                        : `${getSkillCheckResultLabel(organization.settings, check.result)} by ${check.assessorName}`}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                <time dateTime={check.recordedAt} className="text-xs text-muted-foreground">
                    {formatRelativeDateTime(check.recordedAt)}
                </time>
            </ItemActions>
        </Item>
    );
}
