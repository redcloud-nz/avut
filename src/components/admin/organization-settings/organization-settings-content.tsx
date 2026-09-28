/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import type { SaratogaContentsItem } from "@/components/blocks/saratoga-contents";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { useOrganization } from "@/hooks/use-organization";
import type { ModuleFlagState } from "@/lib/module-flags";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { D4HIntegration_SettingsCard } from "./d4h-integration-settings";
import { D4HViewsModule_SettingsCard } from "./d4h-views-module-settings";
import { EmailIntegration_SettingsCard } from "./email-integration-settings";
import { General_SettingsCard } from "./general-settings";
import { I3Module_SettingsCard } from "./i3-module-settings";
import { Personnel_SettingsCard } from "./personnel-settings";
import { RubbishBin_SettingsCard } from "./rubbish-bin-settings";
import { SkillPackageBuilderModule_SettingsCard } from "./skill-package-builder-module-settings";
import { SkillTrackModule_SettingsCard } from "./skill-track-module-settings";

export function AdminModule_Settings_Content() {
    const organization = useOrganization();

    const { data: settings } = useSuspenseQuery(
        trpc.settings.getOrganizationSettings.queryOptions({
            organizationId: organization.id,
        }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Organization",
                        href: route("/orgs/[slug]/admin/organization", { slug: organization.slug }),
                    },
                    "Settings",
                ]}
                actions={<HelpButton slug="admin" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Organisation Settings</Saratoga.Title>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <div id="general" className="space-y-4 scroll-mt-4">
                                <General_SettingsCard />
                            </div>

                            <div id="personnel" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">Personnel</h3>
                                <Personnel_SettingsCard
                                    organizationId={organization.id}
                                    settings={settings}
                                />
                            </div>

                            <div id="rubbish-bin" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">
                                    Rubbish Bin
                                </h3>
                                <RubbishBin_SettingsCard
                                    organizationId={organization.id}
                                    settings={settings}
                                />
                            </div>

                            <div id="integrations" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">
                                    Integrations
                                </h3>
                                <D4HIntegration_SettingsCard
                                    organizationId={organization.id}
                                    settings={settings}
                                />
                                <EmailIntegration_SettingsCard
                                    organizationId={organization.id}
                                    settings={settings}
                                />
                            </div>

                            <div id="modules" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                                <div id="module-d4h-views" className="scroll-mt-4">
                                    <D4HViewsModule_SettingsCard
                                        organizationId={organization.id}
                                        settings={settings}
                                    />
                                </div>
                                {organization.moduleFlags.i3 !== false && (
                                    <div id="module-i3" className="scroll-mt-4">
                                        <I3Module_SettingsCard
                                            organizationId={organization.id}
                                            settings={settings}
                                        />
                                    </div>
                                )}
                                <div id="module-skill-package-builder" className="scroll-mt-4">
                                    <SkillPackageBuilderModule_SettingsCard
                                        organizationId={organization.id}
                                        settings={settings}
                                    />
                                </div>
                                <div id="module-skill-track" className="scroll-mt-4">
                                    <SkillTrackModule_SettingsCard
                                        organizationId={organization.id}
                                        settings={settings}
                                    />
                                </div>
                            </div>
                            <Saratoga.ContentsSpacer />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Saratoga.Contents
                                items={getOrganizationSettingsFormSections(
                                    organization.moduleFlags,
                                )}
                            />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

/**
 * Matches the section (and, for "Modules", per-module card) `id`s above — passed to
 * `Saratoga.Contents` by the page. Takes `moduleFlags` so the "Modules" children stay in sync
 * with which cards the form itself actually renders (e.g. `i3`, gated the same way above).
 */
export function getOrganizationSettingsFormSections(
    moduleFlags: ModuleFlagState,
): SaratogaContentsItem[] {
    return [
        { id: "general", label: "General" },
        { id: "personnel", label: "Personnel" },
        { id: "rubbish-bin", label: "Rubbish Bin" },
        { id: "integrations", label: "Integrations" },
        {
            id: "modules",
            label: "Modules",
            children: [
                { id: "module-d4h-views", label: "D4H Views" },
                ...(moduleFlags.i3 !== false ? [{ id: "module-i3", label: "I3" }] : []),
                { id: "module-skill-package-builder", label: "Skill Package Builder" },
                { id: "module-skill-track", label: "Skill Track" },
            ],
        },
    ];
}
