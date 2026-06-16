/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { route } from "@/lib/routes";

import { Pub_PPEIssue_Form } from "./ppe-issue-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/server/prisma";
import { getOrganizationBySlug } from "@/server/organization";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamData } from "@/lib/schemas/team";
import { TeamMembershipData } from "@/lib/schemas/team-membership";
import { PersonData } from "@/lib/schemas/person";

async function getTeams(organizationId: OrganizationId): Promise<
    (TeamData & {
        members: (TeamMembershipData & { person: PersonData })[];
    })[]
> {
    const teams = await prisma.team.findMany({
        where: {
            organizationId: organizationId,
        },
        include: {
            d4h: true,
            teamMemberships: {
                include: {
                    person: true,
                },
                orderBy: {
                    person: {
                        name: "asc",
                    },
                },
            },
        },
        orderBy: {
            name: "asc",
        },
    });

    return teams.map((team) => ({
        ...TeamData.fromRecord(team),
        members: team.teamMemberships.map((membership) => ({
            ...TeamMembershipData.fromRecord(membership),
            person: PersonData.fromRecord(membership.person),
        })),
    }));
}

export const metadata = {
    title: `PPE Issue Form`,
};

export default async function Pub_PPEIssue_Page(props: PageProps<"/pub/orgs/[slug]/forms/ppe">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teams = await getTeams(organization.id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Forms" },
                    { label: "PPE", href: route("/pub/orgs/[slug]/forms/ppe", { slug }) },
                    "Issue",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Header>
                        <Hermes.BackButton href={route("/pub/orgs/[slug]/forms/ppe", { slug })} />
                        <Hermes.Title>Issue PPE</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Use this form to record the issue of PPE to an individual.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Pub_PPEIssue_Form teams={teams} />
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
