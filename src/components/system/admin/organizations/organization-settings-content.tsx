/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { D4HIntegration_SettingsCard } from "@/components/admin/organization-settings/d4h-integration-settings";
import { D4HViewsModule_SettingsCard } from "@/components/admin/organization-settings/d4h-views-module-settings";
import { EmailIntegration_SettingsCard } from "@/components/admin/organization-settings/email-integration-settings";
import { General_SettingsCard } from "@/components/admin/organization-settings/general-settings";
import { I3Module_SettingsCard } from "@/components/admin/organization-settings/i3-module-settings";
import { getOrganizationSettingsFormSections } from "@/components/admin/organization-settings/organization-settings-content";
import { Personnel_SettingsCard } from "@/components/admin/organization-settings/personnel-settings";
import { RubbishBin_SettingsCard } from "@/components/admin/organization-settings/rubbish-bin-settings";
import { SkillPackageBuilderModule_SettingsCard } from "@/components/admin/organization-settings/skill-package-builder-module-settings";
import { SkillTrackModule_SettingsCard } from "@/components/admin/organization-settings/skill-track-module-settings";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import type { ModuleFlagState } from "@/lib/module-flags";
import { route } from "@/lib/routes";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

/**
 * The same settings form the in-org admin sees, reading and writing through the same
 * `settings.*` procedures. Those are declared `allowSystemAdmin`, so they work for an
 * organization the acting admin is not a member of, and for one that has no
 * `OrganizationConfig` rows yet.
 */
export function SystemAdmin_OrganizationSettings_Content({
    organizationId,
    moduleFlags,
}: {
    organizationId: OrganizationId;
    moduleFlags: ModuleFlagState;
}) {
    const { data: organization } = useSuspenseQuery(
        trpc.systemAdmin.getOrganization.queryOptions({ organizationId }),
    );

    const { data: settings } = useSuspenseQuery(
        trpc.settings.getOrganizationSettings.queryOptions({ organizationId }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system/admin" },
                    { label: "Organizations", href: "/system/admin/organizations" },
                    {
                        label: organization.name,
                        href: route("/system/admin/organizations/[organizationId]", {
                            organizationId,
                        }),
                    },
                    { label: "Settings" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{organization.name} Settings</Saratoga.Title>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <div id="general" className="space-y-4 scroll-mt-4">
                                <General_SettingsCard />
                            </div>

                            <div id="personnel" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">Personnel</h3>
                                <Personnel_SettingsCard
                                    organizationId={organizationId}
                                    settings={settings}
                                />
                            </div>

                            <div id="rubbish-bin" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">
                                    Rubbish Bin
                                </h3>
                                <RubbishBin_SettingsCard
                                    organizationId={organizationId}
                                    settings={settings}
                                />
                            </div>

                            <div id="integrations" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">
                                    Integrations
                                </h3>
                                <D4HIntegration_SettingsCard
                                    organizationId={organizationId}
                                    settings={settings}
                                />
                                <EmailIntegration_SettingsCard
                                    organizationId={organizationId}
                                    settings={settings}
                                />
                            </div>

                            <div id="modules" className="space-y-4 pt-6 scroll-mt-4">
                                <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                                <div id="module-d4h-views" className="scroll-mt-4">
                                    <D4HViewsModule_SettingsCard
                                        organizationId={organizationId}
                                        settings={settings}
                                    />
                                </div>
                                {moduleFlags.i3 !== false && (
                                    <div id="module-i3" className="scroll-mt-4">
                                        <I3Module_SettingsCard
                                            organizationId={organizationId}
                                            settings={settings}
                                        />
                                    </div>
                                )}
                                <div id="module-skill-package-builder" className="scroll-mt-4">
                                    <SkillPackageBuilderModule_SettingsCard
                                        organizationId={organizationId}
                                        settings={settings}
                                    />
                                </div>
                                <div id="module-skill-track" className="scroll-mt-4">
                                    <SkillTrackModule_SettingsCard
                                        organizationId={organizationId}
                                        settings={settings}
                                    />
                                </div>
                            </div>
                            <Saratoga.ContentsSpacer />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Saratoga.Contents
                                items={getOrganizationSettingsFormSections(moduleFlags)}
                            />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
