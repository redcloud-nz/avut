/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/settings/--update
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { D4hIntegration_SettingsCard } from "@/components/admin-settings/d4h-integration-card";
import { D4HViewsModule_SettingsCard } from "@/components/admin-settings/d4h-views-module-card";
import { EmailIntegration_SettingsCard } from "@/components/admin-settings/email-integration-card";
import { General_SettingsCard } from "@/components/admin-settings/general-settings-card";
import { I3Module_SettingsCard } from "@/components/admin-settings/i3-module-card";
import { SkillPackageBuilderModule_SettingsCard } from "@/components/admin-settings/skill-package-builder-module-card";
import { SkillTrackModule_SettingsCard } from "@/components/admin-settings/skill-track-module-card";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

import { trpc } from "@/trpc/client";

export default function AdminModule_Settings_Page(
    props: PageProps<`/orgs/[slug]/admin/organization/settings`>,
) {
    const { slug } = use(props.params);
    const organization = useOrganization();

    const { data: settings } = useSuspenseQuery(
        trpc.settings.getOrganizationSettings.queryOptions({
            organizationId: organization.id,
        }),
    );

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    {
                        label: "Organization",
                        href: route("/orgs/[slug]/admin/organization", { slug }),
                    },
                    "Settings",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Organization Settings</Saratoga.Title>
                    </Saratoga.Header>

                    <div className="space-y-4">
                        <General_SettingsCard />
                    </div>

                    <div className="space-y-4 pt-6">
                        <h3 className="text-lg font-semibold tracking-tight">Integrations</h3>
                        <D4hIntegration_SettingsCard
                            organizationId={organization.id}
                            settings={settings}
                        />
                        <EmailIntegration_SettingsCard
                            organizationId={organization.id}
                            settings={settings}
                        />
                    </div>

                    <div className="space-y-4 pt-6">
                        <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                        <D4HViewsModule_SettingsCard
                            organizationId={organization.id}
                            settings={settings}
                        />
                        <I3Module_SettingsCard
                            organizationId={organization.id}
                            settings={settings}
                        />
                        <SkillPackageBuilderModule_SettingsCard
                            organizationId={organization.id}
                            settings={settings}
                        />
                        <SkillTrackModule_SettingsCard
                            organizationId={organization.id}
                            settings={settings}
                        />
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
