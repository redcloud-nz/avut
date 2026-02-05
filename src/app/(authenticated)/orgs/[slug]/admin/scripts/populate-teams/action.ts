/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

"use server";

import { getD4HTeamsWithMembers } from "@/lib/d4h-api/client";
import { nanoId16 } from "@/lib/id";
import { D4hAccessTokenData } from "@/lib/schemas/d4h-access-token";
import prisma from "@/server/prisma";

export async function populateTeamsAction(organizationId: string) {
    const d4hAccessToken = await prisma.d4hAccessToken.findFirst({
        where: {
            organizationId: organizationId,
        },
    });

    if (!d4hAccessToken) {
        throw new Error("No D4H access token found for organization");
    }

    const d4hTeams = await getD4HTeamsWithMembers(
        D4hAccessTokenData.fromRecord(d4hAccessToken),
    );

    const teams = await prisma.team.findMany({
        where: {
            organizationId: organizationId,
        },
    });

    const personnel = await prisma.person.findMany({
        where: {
            organizationId: organizationId,
        },
    });

    const teamMemberships = await prisma.teamMembership.findMany({
        where: {
            teamId: { in: teams.map((t) => t.id) },
        },
    });

    // Find the teams that are in D4H but not in our database, and create them.
    for (const d4hTeam of d4hTeams) {
        let team = teams.find((t) => {
            const props = t.properties as Record<string, any>;
            return props.d4hTeamId === d4hTeam.id;
        });

        if (!team) {
            team = await prisma.team.create({
                data: {
                    id: nanoId16(),
                    organizationId: organizationId,
                    name: d4hTeam.title,
                    properties: {
                        d4hTeamId: d4hTeam.id,
                    },
                },
            });
        }

        await Promise.all(
            d4hTeam.members.map(async (d4hTeamMember) => {
                let person = personnel.find((p) => {
                    return p.email === d4hTeamMember.email.value;
                });

                if (!person) {
                    person = await prisma.person.create({
                        data: {
                            id: nanoId16(),
                            organizationId: organizationId,
                            name: d4hTeamMember.name,
                            email: d4hTeamMember.email.value,
                        },
                    });
                    personnel.push(person);
                }

                const teamMembership = teamMemberships.find((tm) => {
                    const props = tm.properties as Record<string, any>;
                    return props.d4hTeamMemberId === d4hTeamMember.id;
                });

                if (!teamMembership) {
                    await prisma.teamMembership.create({
                        data: {
                            id: nanoId16(),
                            teamId: team!.id,
                            personId: person!.id,
                            properties: {
                                d4hTeamMemberId: d4hTeamMember.id,
                            },
                        },
                    });
                }
            }),
        );
    }
}
