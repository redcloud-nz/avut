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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

/**
 * What the skill check entry pages show in place of their content while the session is approved:
 * its checks are locked until it's reopened, so there is nothing to record. Links back to the
 * session page.
 */
export function SkillTrack_SessionApprovedEmpty({ sessionId }: { sessionId: SkillCheckSessionId }) {
    const organization = useOrganization();

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <LockIcon />
                </EmptyMedia>
                <EmptyTitle>This session has been approved.</EmptyTitle>
                <EmptyDescription>Reopen it to record or change checks.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button variant="outline" asChild>
                    <Link
                        href={route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                            slug: organization.slug,
                            session_id: sessionId,
                        })}
                    >
                        Back to session
                    </Link>
                </Button>
            </EmptyContent>
        </Empty>
    );
}
