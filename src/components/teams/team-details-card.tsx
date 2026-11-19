/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { ComponentProps } from "react";

import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { TeamData } from "@/lib/schemas/team";

import { Teams_UpdateTeam_Dialog } from "./update-team";

export function Teams_Details_Card({
    team,
    requireSlug,
    onUpdated,
}: {
    team: TeamData;
} & Pick<ComponentProps<typeof Teams_UpdateTeam_Dialog>, "requireSlug" | "onUpdated">) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Team Details</CardTitle>
                <CardAction>
                    <Protect permissions={{ team: ["update"] }}>
                        <Teams_UpdateTeam_Dialog
                            team={team}
                            requireSlug={requireSlug}
                            onUpdated={onUpdated}
                        />
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>Team ID</DataItemTitle>
                        <DataItemValue className="font-mono">{team.id}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Name</DataItemTitle>
                        <DataItemValue>{team.name}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
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
                    <DataItem inline>
                        <DataItemTitle>Status</DataItemTitle>
                        <DataItemValue>{team.status}</DataItemValue>
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}
