/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

"use client";

import { useState } from "react";

import { UserAccountSettings } from "@/components/user-settings/user-account-settings";
import { UserIntegrationsSettings } from "@/components/user-settings/user-integrations-settings";
import { UserOrganizationsSettings } from "@/components/user-settings/user-organizations-settings";
import { UserSecuritySettings } from "@/components/user-settings/user-security-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UserSettings_PageContent() {
    const [currentTab, setCurrentTab] = useState<
        "account" | "security" | "organizations" | "integrations"
    >("account");

    return (
        <Tabs
            value={currentTab}
            onValueChange={(value) => setCurrentTab(value as typeof currentTab)}
            className="space-y-4 min-h-[50vh]"
        >
            <TabsList>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="organizations">Organizations</TabsTrigger>
                <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>
            <TabsContent value="account">
                <UserAccountSettings />
            </TabsContent>
            <TabsContent value="security">
                <UserSecuritySettings />
            </TabsContent>
            <TabsContent value="organizations">
                <UserOrganizationsSettings />
            </TabsContent>
            <TabsContent value="integrations">
                <UserIntegrationsSettings />
            </TabsContent>
        </Tabs>
    );
}
