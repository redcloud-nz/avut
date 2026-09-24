/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import {
    getOrganizationSettingsFormSections,
    OrganizationSettingsForm,
} from "@/components/admin-settings/organization-settings-form";
import { OrganizationSettingsScopeProvider } from "@/components/admin-settings/settings-scope";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function AdminModule_Settings_Content() {
    const organization = useOrganization();

    const { data: settings } = useSuspenseQuery(
        trpc.settings.getOrganizationSettings.queryOptions({
            organizationId: organization.id,
        }),
    );

    return (
        <OrganizationSettingsScopeProvider scope="organization">
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
                            <OrganizationSettingsForm
                                organizationId={organization.id}
                                settings={settings}
                                moduleFlags={organization.moduleFlags}
                            />
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
        </OrganizationSettingsScopeProvider>
    );
}
