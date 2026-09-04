/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Building2Icon, ChevronDownIcon, ChevronRightIcon, UsersIcon } from "lucide-react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

/** Report routes that carry a team/org scope in `?team` (`all` = whole organization). */
type TeamScopedRoute =
    | "/orgs/[slug]/skill-track/reports/team"
    | "/orgs/[slug]/skill-track/reports/matrix";

const REPORT_BREADCRUMB: Record<TeamScopedRoute | SkillScopedRoute, string> = {
    "/orgs/[slug]/skill-track/reports/team": "Team Competency",
    "/orgs/[slug]/skill-track/reports/matrix": "Personnel × Skill Matrix",
    "/orgs/[slug]/skill-track/reports/skill": "Skill Coverage",
};

function ReportNavbar({ routePattern }: { routePattern: TeamScopedRoute | SkillScopedRoute }) {
    const { slug } = useOrganization();
    return (
        <Std.Navbar
            breadcrumbs={[
                { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                { label: "Reports", href: route("/orgs/[slug]/skill-track/reports", { slug }) },
                { label: REPORT_BREADCRUMB[routePattern], href: route(routePattern, { slug }) },
            ]}
        />
    );
}

/**
 * Scope picker for the team/org competency reports (#43, #44). Lists every team plus an
 * explicit "Whole Organization" option; picking one sets `?team=<id|all>` on the report route.
 */
export function SkillTrack_ReportTeamScopePicker({
    routePattern,
}: {
    routePattern: TeamScopedRoute;
}) {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );

    const pathname = route(routePattern, { slug: organization.slug });

    return (
        <>
            <ReportNavbar routePattern={routePattern} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Select a Scope</Saratoga.Title>
                    </Saratoga.Header>
                    <div className="mt-4 space-y-2">
                        <Item asChild>
                            <Link href={{ pathname, query: { team: "all" } }}>
                                <ItemMedia>
                                    <Building2Icon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>Whole Organization</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>

                        {teams.length === 0 ? (
                            <Empty>
                                <EmptyMedia>
                                    <UsersIcon className="size-12 text-muted-foreground" />
                                </EmptyMedia>
                                <EmptyDescription>
                                    This organization has no teams — use Whole Organization.
                                </EmptyDescription>
                            </Empty>
                        ) : (
                            R.pipe(
                                teams,
                                R.sortBy((team) => team.name),
                                R.map((team) => (
                                    <Item asChild key={team.id}>
                                        <Link href={{ pathname, query: { team: team.id } }}>
                                            <ItemMedia>
                                                <UsersIcon className="size-5" />
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle>{team.name}</ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon className="size-4" />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                )),
                            )
                        )}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

type SkillScopedRoute = "/orgs/[slug]/skill-track/reports/skill";

/**
 * Skill picker for the Skill Coverage report (#45): a package → group → skill tree backed by
 * `skills.listAssessableSkills`. Picking a skill sets `?skill=<id>` on the report route.
 */
export function SkillTrack_ReportSkillScopePicker({
    routePattern,
}: {
    routePattern: SkillScopedRoute;
}) {
    const organization = useOrganization();

    const {
        data: { skillPackages, skillGroups, skills },
    } = useSuspenseQuery(
        trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }),
    );

    const [search, setSearch] = useState("");

    const pathname = route(routePattern, { slug: organization.slug });

    const needle = search.trim().toLowerCase();
    const matchingSkills = needle
        ? skills.filter((skill) => skill.name.toLowerCase().includes(needle))
        : skills;

    const packageSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.map((skillPackage) => ({
            skillPackage,
            groups: R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.map((skillGroup) => ({
                    skillGroup,
                    skills: R.pipe(
                        matchingSkills,
                        R.filter((skill) => skill.skillGroupId === skillGroup.id),
                        R.sortBy((skill) => skill.sequence),
                    ),
                })),
                R.filter(({ skills }) => skills.length > 0),
            ),
        })),
        R.filter(({ groups }) => groups.length > 0),
    );

    return (
        <>
            <ReportNavbar routePattern={routePattern} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Select a Skill</Saratoga.Title>
                    </Saratoga.Header>

                    <div className="mt-4">
                        <Input
                            placeholder="Search skills…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="max-w-sm"
                        />
                    </div>

                    {packageSections.length === 0 ? (
                        <Empty>
                            <EmptyDescription>
                                {needle
                                    ? "No skills match your search."
                                    : "This organization is not subscribed to any skill packages."}
                            </EmptyDescription>
                        </Empty>
                    ) : (
                        <div className="mt-6 space-y-6">
                            {packageSections.map(({ skillPackage, groups }) => (
                                <Collapsible key={skillPackage.id} defaultOpen>
                                    <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                                        <span>{skillPackage.name}</span>
                                        <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="space-y-6 pt-4">
                                            {groups.map(({ skillGroup, skills }) => (
                                                <div key={skillGroup.id}>
                                                    <div className="text-sm font-medium text-muted-foreground mb-2">
                                                        {skillGroup.name}
                                                    </div>
                                                    {skills.map((skill) => (
                                                        <Item asChild key={skill.id}>
                                                            <Link
                                                                href={{
                                                                    pathname,
                                                                    query: { skill: skill.id },
                                                                }}
                                                            >
                                                                <ItemContent>
                                                                    <ItemTitle>
                                                                        {skill.name}
                                                                    </ItemTitle>
                                                                </ItemContent>
                                                                <ItemActions>
                                                                    <ChevronRightIcon className="size-4" />
                                                                </ItemActions>
                                                            </Link>
                                                        </Item>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

export { ReportNavbar };
