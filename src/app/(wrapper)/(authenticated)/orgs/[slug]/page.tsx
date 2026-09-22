/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import {
    ClipboardCheckIcon,
    ClipboardListIcon,
    PackageIcon,
    PocketKnifeIcon,
    ShieldCheckIcon,
    UserIcon,
    UserPlusIcon,
    UsersIcon,
} from "lucide-react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { Heading } from "@/components/ui/typography";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { getOrganizationSettings } from "@/server/cache/organization-settings";
import { resolveModuleFlags } from "@/server/module-flags";

/*
 * The stat values below are hardcoded fixture data, not wired to real queries yet —
 * this page is the promoted-from-lab visual design, not the final data-wired dashboard.
 */
export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);
    const moduleFlags = await resolveModuleFlags();

    const skillTrackEnabled =
        moduleFlags["skill-track"] !== false && settings.modules["skill-track"].enabled;

    const adminStatCards = [
        {
            label: "Active Personnel",
            value: 42,
            icon: UsersIcon,
            href: route("/orgs/[slug]/admin/personnel", { slug }),
        },
        {
            label: "Teams",
            value: 6,
            icon: ShieldCheckIcon,
            href: route("/orgs/[slug]/admin/teams", { slug }),
        },
        {
            label: "Pending Invitations",
            value: 3,
            icon: UserPlusIcon,
            href: route("/orgs/[slug]/admin/invitations", { slug }),
        },
        {
            label: "Users",
            value: 15,
            icon: UserIcon,
            href: route("/orgs/[slug]/admin/users", { slug }),
        },
    ] as const;

    const skillTrackStatCards = [
        {
            label: "Skill Packages",
            value: 4,
            icon: PackageIcon,
            href: route("/orgs/[slug]/skill-track/catalogue", { slug }),
        },
        {
            label: "Skills",
            value: 56,
            icon: PocketKnifeIcon,
            href: route("/orgs/[slug]/skill-track/catalogue", { slug }),
        },
        {
            label: "Skill Check Sessions",
            value: 16,
            icon: ClipboardListIcon,
            href: route("/orgs/[slug]/skill-track/sessions", { slug }),
        },
        {
            label: "Skill Checks",
            value: 128,
            icon: ClipboardCheckIcon,
            href: route("/orgs/[slug]/skill-track/checks", { slug }),
        },
    ] as const;

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
                            <StatCardGrid>
                                {adminStatCards.map((card) => (
                                    <StatCard key={card.label} {...card} />
                                ))}
                            </StatCardGrid>
                        </section>

                        {skillTrackEnabled && (
                            <section className="space-y-4">
                                <Heading level={2}>Skill Track</Heading>
                                <StatCardGrid>
                                    {skillTrackStatCards.map((card) => (
                                        <StatCard key={card.label} {...card} />
                                    ))}
                                </StatCardGrid>
                            </section>
                        )}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
