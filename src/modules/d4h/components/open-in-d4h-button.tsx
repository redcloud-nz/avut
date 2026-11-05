/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ExternalLinkIcon } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { D4HWebRecord } from "@/lib/d4h-servers";
import { trpc } from "@/trpc/client";

/** A header button opening a record's page in D4H's web app, in a new tab. */
export function D4HModule_OpenInD4H_Button({ href }: { href: string }) {
    return (
        // Icon-only below `sm`, with the label kept for screen readers.
        <Button asChild variant="outline" className="max-sm:w-8 max-sm:px-0">
            <a href={href} target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                <span className="sr-only sm:not-sr-only">Open in D4H</span>
            </a>
        </Button>
    );
}

/** A catalogue record's owning team, for {@link D4HModule_OpenRecordInD4H_Button}'s `teamId`. */
export function ownerTeamId(owner: { resourceType: "Team" | "Organisation"; id: number }) {
    return owner.resourceType === "Team" ? owner.id : undefined;
}

/**
 * {@link D4HModule_OpenInD4H_Button} for a team, member or catalogue record, whose URL the server
 * builds (see `d4hApi.getD4HWebUrl`). Renders nothing until the URL arrives, or if it can't be
 * built: the page shouldn't wait or fail over a link out.
 */
export function D4HModule_OpenRecordInD4H_Button({
    record,
    id,
    teamId,
}: {
    record: D4HWebRecord;
    id: number;
    /** The record's team: its own for a team or member, its owner's for a catalogue record. */
    teamId?: number;
}) {
    const organization = useOrganization();
    const { data: href } = useQuery(
        trpc.d4hApi.getD4HWebUrl.queryOptions({
            organizationId: organization.id,
            record,
            id,
            teamId,
        }),
    );

    return href ? <D4HModule_OpenInD4H_Button href={href} /> : null;
}
