/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { Route } from "next";
import type { ComponentProps } from "react";

import { Protect } from "@/components/protect";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { TeamData } from "@/lib/schemas/team";

import { Teams_UpdateTeam_Dialog } from "./update-team";

/**
 * The team's own record card ("Team"), shared by the org team page and team admin. The team's
 * status isn't a row: the org team page shows a non-Active status as a title badge.
 */
export function Teams_Details_Card({
    team,
    historyHref,
    requireSlug,
    onUpdated,
}: {
    team: TeamData;
    /** The team's History page, where the scope has one: the footer's Updated line links to it. */
    historyHref?: Route;
} & Pick<ComponentProps<typeof Teams_UpdateTeam_Dialog>, "requireSlug" | "onUpdated">) {
    return (
        <RecordCard
            label="Team"
            updatedAt={team.updatedAt ?? undefined}
            historyHref={historyHref}
            action={
                <Protect permissions={{ team: ["update"] }}>
                    <Teams_UpdateTeam_Dialog
                        team={team}
                        requireSlug={requireSlug}
                        onUpdated={onUpdated}
                    />
                </Protect>
            }
        >
            <CardContent>
                <DataList>
                    <RecordCardId label="Team ID" id={team.id} />
                    <DataItem>
                        <DataItemTitle>Name</DataItemTitle>
                        <DataItemValue>{team.name}</DataItemValue>
                    </DataItem>
                    <DataItem>
                        <DataItemTitle>Slug</DataItemTitle>
                        {team.slug ? (
                            <DataItemValue className="font-mono">{team.slug}</DataItemValue>
                        ) : (
                            <DataItemValue className="text-muted-foreground">None</DataItemValue>
                        )}
                    </DataItem>
                    <DataItem>
                        <DataItemTitle>Description</DataItemTitle>
                        <DataItemValue>{team.description}</DataItemValue>
                    </DataItem>
                </DataList>
            </CardContent>
        </RecordCard>
    );
}
