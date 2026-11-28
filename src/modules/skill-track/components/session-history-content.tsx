/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillTrack_SessionHistory_Content({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();
    const scopedRoute = useScopedRoute();

    const { data: session } = useSuspenseQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
        }),
    );

    const sessionName = session.name || session.id;

    return (
        <ObjectHistory
            objectType="SkillCheckSession"
            objectId={sessionId}
            title="Session History"
            breadcrumbs={[
                {
                    label: "Skill Check Sessions",
                    href: scopedRoute(
                        {
                            organization: "/orgs/[slug]/skill-track/sessions",
                            team: "/teams/[slug]/skill-track/sessions",
                        },
                        {},
                    ),
                },
                {
                    label: sessionName,
                    href: scopedRoute(
                        {
                            organization: "/orgs/[slug]/skill-track/sessions/[session_id]",
                            team: "/teams/[slug]/skill-track/sessions/[session_id]",
                        },
                        { session_id: sessionId },
                    ),
                },
            ]}
        />
    );
}
