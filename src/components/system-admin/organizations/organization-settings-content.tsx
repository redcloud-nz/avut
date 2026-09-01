/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { OrganizationSettingsForm } from "@/components/admin-settings/organization-settings-form";
import { OrganizationSettingsScopeProvider } from "@/components/admin-settings/settings-scope";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

/**
 * The same settings form the in-org admin sees, but reading and writing through the
 * `systemAdmin.*` procedures — so it works for an organization the acting admin is not a member
 * of, and for one that has no `OrganizationConfig` rows yet.
 */
export function SystemAdmin_OrganizationSettings_Content({
    organizationId,
}: {
    organizationId: OrganizationId;
}) {
    const { data: organization } = useSuspenseQuery(
        trpc.systemAdmin.getOrganization.queryOptions({ organizationId }),
    );

    const { data: settings } = useSuspenseQuery(
        trpc.systemAdmin.getOrganizationSettings.queryOptions({ organizationId }),
    );

    return (
        <OrganizationSettingsScopeProvider scope="system-admin">
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system-admin" },
                    { label: "Organizations", href: "/system-admin/organizations" },
                    {
                        label: organization.name,
                        href: route("/system-admin/organizations/[organizationId]", {
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

                    <OrganizationSettingsForm organizationId={organizationId} settings={settings} />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </OrganizationSettingsScopeProvider>
    );
}
