/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { publicFormsEffects } from "@/client/public-forms-effects";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import { useLogger } from "@/hooks/use-logger";
import {
    DEFAULT_DISPLAY_PREFERENCES,
    formatDate,
    formatDateTime,
    type DisplayPreferences,
} from "@/lib/datetime";
import type { SelfAuditAnswerData, SelfAuditResponseData } from "@/lib/schemas/self-audit";
import type { SelfAuditAnswer, SelfAuditResponse } from "@/lib/self-audit-types";
import { trpc, type RouterOutput } from "@/trpc/client";

import { SelfAudit_Form } from "./self-audit-form";
import { SelfAudit_Summary } from "./self-audit-summary";

type SelfAuditByToken = Extract<
    RouterOutput["publicForms"]["getSelfAuditByToken"],
    { state: "ok" }
>;

/** The member has no account, so no display preferences: written dates, in NZ time. */
const MEMBER_DATES: DisplayPreferences = { ...DEFAULT_DISPLAY_PREFERENCES, dateFormat: "written" };

/**
 * The page a self-audit's emailed link opens (`/forms/kit-check/<token>`): the member's form while
 * it's a draft, autosaving as they go, and what they sent once it's submitted, with a way back in
 * while the link lasts. Works signed out or in; the token is the only access.
 *
 * @param token The link token from the email. Never logged.
 */
export function SelfAudit_Member({ token }: { token: string }) {
    const { data } = useSuspenseQuery(trpc.publicForms.getSelfAuditByToken.queryOptions({ token }));

    if (data.state === "not-found") return <SelfAuditLinkInvalid_Card />;

    return <SelfAudit_MemberOpened token={token} selfAudit={data} />;
}

/** Shown for a link token that finds no live request: unknown, replaced by a resend, or expired. */
export function SelfAuditLinkInvalid_Card() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>This link has expired or isn&apos;t valid</CardTitle>
                <CardDescription>Ask whoever sent it for a new one.</CardDescription>
            </CardHeader>
        </Card>
    );
}

function SelfAudit_MemberOpened({
    token,
    selfAudit,
}: {
    token: string;
    selfAudit: SelfAuditByToken;
}) {
    const logger = useLogger("SelfAudit", "SelfAudit_Member");

    // Record the open from the browser, once, rather than on GET: email link scanners fetch
    // every URL (decision 7). The first draft save records it too, if this call is lost.
    const { mutate: markOpened } = useMutation(
        trpc.publicForms.openSelfAuditByToken.mutationOptions({
            onError(error) {
                logger.warn("Failed to record that the self-audit was opened", error.message);
            },
        }),
    );
    const openSent = useRef(false);
    useEffect(() => {
        if (openSent.current) return;
        openSent.current = true;
        markOpened({ token });
    }, [markOpened, token]);

    return selfAudit.formStatus === "Submitted" ? (
        <SelfAudit_MemberSubmitted token={token} selfAudit={selfAudit} />
    ) : (
        <SelfAudit_MemberDraft token={token} selfAudit={selfAudit} />
    );
}

function SelfAudit_MemberDraft({
    token,
    selfAudit,
}: {
    token: string;
    selfAudit: SelfAuditByToken;
}) {
    const logger = useLogger("SelfAudit", "SelfAudit_MemberDraft");

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    const queryClient = useQueryClient();
    /**
     * The form was submitted elsewhere (another tab), or the link was replaced or has expired:
     * refetch, so the page shows the submitted view or the not-valid card, not a stuck draft.
     */
    function refetchIfGone(code: string | undefined): boolean {
        if (code !== "CONFLICT" && code !== "NOT_FOUND") return false;
        void queryClient.invalidateQueries(
            trpc.publicForms.getSelfAuditByToken.queryFilter({ token }),
        );
        return true;
    }

    const submit = useMutation(
        trpc.publicForms.submitSelfAuditByToken.mutationOptions({
            meta: { effects: publicFormsEffects.submitSelfAuditByToken },
            onError(error) {
                if (refetchIfGone(error.data?.code)) {
                    logger.warn("Self-audit already submitted or link gone", error.message);
                    return;
                }
                logger.error("Failed to submit the self-audit", error.message);
                toast.error(`Couldn't send your answers: ${error.message}`);
            },
        }),
    );
    const submitting = submit.isPending || submit.isSuccess;

    // No effects: the open form isn't re-seeded from the cache while the member types.
    const save = useMutation(
        trpc.publicForms.saveSelfAuditDraftByToken.mutationOptions({
            onError(error) {
                const code = error.data?.code;
                // The member's own save landing after their submit: expected, nothing to show.
                if (code === "CONFLICT" && submitting) return;
                if (refetchIfGone(code)) {
                    logger.warn("Self-audit draft save refused", error.message);
                    return;
                }
                logger.error("Failed to save the self-audit draft", error.message);
            },
        }),
    );
    const saveStatus =
        save.status === "error" && save.error.data?.code === "CONFLICT" && submitting
            ? "idle"
            : save.status;

    const { handleChange, cancel, flush } = useDebouncedAutosave<SelfAuditResponse>({
        save: (response) => save.mutate({ token, formData: toResponseData(response) }),
        status: save.status,
        reset: save.reset,
    });

    // Hiding the page sends a save still waiting to go, unless a submit carries it. On a tab or
    // app switch the save is reliable; on a close it's best effort, as the browser may drop it.
    const onHide = useEffectEvent(() => {
        if (!submitting) flush();
    });
    useEffect(() => {
        const onPageHide = () => onHide();
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") onHide();
        };
        window.addEventListener("pagehide", onPageHide);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("pagehide", onPageHide);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    function handleSubmit(response: SelfAuditResponse) {
        if (submit.isPending) return;
        // Drop a save still waiting to go: the submit carries the same answers. Not flushed
        // instead: the save would batch with the submit, and the submit must go out on its own so
        // BotID can check it (`src/lib/public-forms.ts`).
        cancel();
        submit.mutate(
            { token, formData: toResponseData(response) },
            {
                onError(error) {
                    // `cancel()` dropped the queued save: queue these answers again, so a failed
                    // submit doesn't lose the latest edits. Not when the draft is gone.
                    const code = error.data?.code;
                    if (code !== "CONFLICT" && code !== "NOT_FOUND") handleChange(response);
                },
            },
        );
    }

    return (
        <>
            {selfAudit.submittedAt && (
                <Alert variant="info">
                    <AlertDescription>
                        You sent your answers on{" "}
                        {formatDateTime(selfAudit.submittedAt, MEMBER_DATES)}. Those stand until you
                        send them again.
                    </AlertDescription>
                </Alert>
            )}
            <SelfAudit_Form
                notice={
                    <>
                        Your answers save as you go. This link works until{" "}
                        {formatDate(selfAudit.expiresAt, MEMBER_DATES)}.
                    </>
                }
                subject={selfAudit.subject}
                templates={selfAudit.templates}
                heldItems={selfAudit.heldItems}
                initialResponse={{ ...selfAudit.formData, proposals: {} }}
                onChange={handleChange}
                onSubmit={handleSubmit}
                // Stays disabled after a success, until the refetch shows the submitted view.
                submitting={submitting}
                footer={
                    <div role="status" aria-live="polite">
                        <SaveStatusIndicator status={saveStatus} />
                    </div>
                }
            />
        </>
    );
}

function SelfAudit_MemberSubmitted({
    token,
    selfAudit,
}: {
    token: string;
    selfAudit: SelfAuditByToken;
}) {
    const logger = useLogger("SelfAudit", "SelfAudit_MemberSubmitted");

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    const reopen = useMutation(
        trpc.publicForms.reopenSelfAuditByToken.mutationOptions({
            meta: { effects: publicFormsEffects.reopenSelfAuditByToken },
            onError(error) {
                logger.error("Failed to reopen the self-audit", error.message);
                toast.error(`Couldn't reopen your answers: ${error.message}`);
            },
        }),
    );

    return (
        <>
            <SelfAudit_Summary
                templates={selfAudit.templates}
                heldItems={selfAudit.heldItems}
                response={selfAudit.submittedData ?? selfAudit.formData}
            />
            <p className="text-sm text-muted-foreground">
                {selfAudit.submittedAt &&
                    `Sent ${formatDateTime(selfAudit.submittedAt, MEMBER_DATES)}. `}
                You can change your answers until {formatDate(selfAudit.expiresAt, MEMBER_DATES)}.
            </p>
            <Button
                variant="outline"
                className="self-start"
                disabled={reopen.isPending || reopen.isSuccess}
                onClick={() => reopen.mutate({ token })}
            >
                Change my answers
            </Button>
        </>
    );
}

/**
 * The form's response as the procedures take it. The emailed form offers no "Using my own" and
 * no considered items (decision 4), so `own` never comes up and `proposals` is dropped.
 */
function toResponseData({
    held,
    missing,
    extras,
    comments,
}: SelfAuditResponse): SelfAuditResponseData {
    return { held: toAnswersData(held), missing: toAnswersData(missing), extras, comments };
}

function toAnswersData(
    answers: Record<string, SelfAuditAnswer>,
): Record<string, SelfAuditAnswerData> {
    return Object.fromEntries(
        Object.entries(answers).map(([key, { has, ...rest }]) => [
            key,
            { ...rest, has: has === "own" ? null : has },
        ]),
    );
}
