/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";

import { Pub_PPEIssue_Form } from "./ppe-issue-form";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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

export default async function Pub_PPEIssue_Page(
    props: PageProps<"/pub/orgs/[slug]/forms/ppe">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teams = await getTeams(organization.id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.pub(slug).forms.index,
                    Paths.pub(slug).forms.ppe,
                    Paths.pub(slug).forms.ppe.issue,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton to={Paths.pub(slug).forms.ppe}>
                                PPE Forms
                            </Hermes.BackButton>
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>PPE Issue Form</CardTitle>
                                <CardDescription>
                                    Use this form to record the issue of PPE to
                                    an individual.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Pub_PPEIssue_Form teams={teams} />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
