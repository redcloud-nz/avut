/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon, ClipboardListIcon, PackageIcon, PocketKnifeIcon } from "lucide-react";
import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/ui/stat-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function Organization_Dashboard_SkillTrackStats() {
    return (
        <StatCardGrid>
            <Protect permissions={{ skillPackageSubscription: ["view"] }}>
                <Suspense
                    fallback={
                        <>
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                        </>
                    }
                >
                    <Organization_Dashboard_SkillPackageAndSkillStats />
                </Suspense>
                <Suspense fallback={<StatCardSkeleton />}>
                    <Organization_Dashboard_SkillCheckSessionsStat />
                </Suspense>
            </Protect>
            <Protect permissions={{ skillCheck: ["view"] }}>
                <Suspense fallback={<StatCardSkeleton />}>
                    <Organization_Dashboard_SkillChecksStat />
                </Suspense>
            </Protect>
        </StatCardGrid>
    );
}

function Organization_Dashboard_SkillPackageAndSkillStats() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: assessable } = useSuspenseQuery(
        trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }),
    );

    const catalogueHref = route("/orgs/[slug]/skill-track/catalogue", { slug });

    return (
        <>
            <StatCard
                label="Skill Packages"
                value={assessable.skillPackages.length}
                icon={PackageIcon}
                href={catalogueHref}
            />
            <StatCard
                label="Skills"
                value={assessable.skills.length}
                icon={PocketKnifeIcon}
                href={catalogueHref}
            />
        </>
    );
}

function Organization_Dashboard_SkillCheckSessionsStat() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: sessions } = useSuspenseQuery(
        trpc.skills.listSessions.queryOptions({ organizationId: organization.id }),
    );

    return (
        <StatCard
            label="Skill Check Sessions"
            value={sessions.length}
            icon={ClipboardListIcon}
            href={route("/orgs/[slug]/skill-track/sessions", { slug })}
        />
    );
}

function Organization_Dashboard_SkillChecksStat() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: skillChecks } = useSuspenseQuery(
        trpc.skillChecks.listSkillChecks.queryOptions({ organizationId: organization.id }),
    );

    return (
        <StatCard
            label="Skill Checks"
            value={skillChecks.length}
            icon={ClipboardCheckIcon}
            href={route("/orgs/[slug]/skill-track/checks", { slug })}
        />
    );
}
