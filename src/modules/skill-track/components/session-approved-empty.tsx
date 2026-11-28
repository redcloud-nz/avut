/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

/**
 * What the skill check entry pages show in place of their content while the session is locked
 * (`useSessionAccess`), so there is nothing to record. `reason` says why: it's `approved` (its
 * checks are locked until it's reopened), or `foreign`, another team's or an org session seen in
 * team scope, which can't be changed there. Links back to the session page.
 */
export function SkillTrack_SessionApprovedEmpty({
    sessionId,
    reason,
}: {
    sessionId: SkillCheckSessionId;
    reason: "approved" | "foreign";
}) {
    const scopedRoute = useScopedRoute();

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <LockIcon />
                </EmptyMedia>
                {reason === "foreign" ? (
                    <>
                        <EmptyTitle>This session is view only in this team.</EmptyTitle>
                        <EmptyDescription>
                            It isn&apos;t this team&apos;s session, so its checks can&apos;t be
                            recorded or changed here.
                        </EmptyDescription>
                    </>
                ) : (
                    <>
                        <EmptyTitle>This session has been approved.</EmptyTitle>
                        <EmptyDescription>Reopen it to record or change checks.</EmptyDescription>
                    </>
                )}
            </EmptyHeader>
            <EmptyContent>
                <Button variant="outline" asChild>
                    <Link
                        href={scopedRoute(
                            {
                                organization: "/orgs/[slug]/skill-track/sessions/[session_id]",
                                team: "/teams/[slug]/skill-track/sessions/[session_id]",
                            },
                            { session_id: sessionId },
                        )}
                    >
                        Back to session
                    </Link>
                </Button>
            </EmptyContent>
        </Empty>
    );
}
