/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import {
    getOrganizationSettingsFormSections,
    OrganizationSettingsForm,
} from "./organization-settings-form";

export function AdminModule_Settings_Content() {
    const organization = useOrganization();
    const canEdit = useHasPermission({ organization: ["update"] });

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
                    "Organisation Settings",
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
                                moduleFlags={organization.moduleFlags}
                                settings={settings}
                                canEdit={canEdit}
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
        </>
    );
}
