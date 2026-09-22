/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Suspense } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Organization_Dashboard_AdminStats } from "@/components/organization/dashboard-admin-stats";
import { Organization_Dashboard_SkillTrackStats } from "@/components/organization/dashboard-skill-track-stats";
import { CardLoadingFallback } from "@/components/ui/card";
import { Heading } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";

export function Organization_Dashboard_Content() {
    const organization = useOrganization();
    const skillTrackEnabled = organization.isModuleEnabled("skill-track");

    return (
        <>
            <Std.Navbar breadcrumbs={[organization.name]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{organization.name}</Saratoga.Title>
                    </Saratoga.Header>

                    <div className="space-y-8">
                        <section className="space-y-4">
                            <Heading level={2}>Admin</Heading>
                            <Suspense fallback={<CardLoadingFallback />}>
                                <Organization_Dashboard_AdminStats />
                            </Suspense>
                        </section>

                        {skillTrackEnabled && (
                            <section className="space-y-4">
                                <Heading level={2}>Skill Track</Heading>
                                <Suspense fallback={<CardLoadingFallback />}>
                                    <Organization_Dashboard_SkillTrackStats />
                                </Suspense>
                            </section>
                        )}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
