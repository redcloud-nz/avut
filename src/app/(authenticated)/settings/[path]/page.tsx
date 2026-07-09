/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /settings/[path]
 */

import { headers as nextHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { auth } from "@/server/auth";

import { UserAccountSettings } from "./user-account-settings";
import { UserOrganizationsSettings } from "./user-organizations-settings";
import { UserSecuritySettings } from "./user-security-settings";
import { Settings_TabsList } from "./settings-tabs-list";

export const metadata = {
    title: "Settings",
};

const allowedPaths = ["account", "security", "organizations"];

export default async function Settings_Page(props: PageProps<"/settings/[path]">) {
    const { path } = await props.params;

    if (!allowedPaths.includes(path)) {
        notFound();
    }

    const headers = await nextHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) redirect("/auth/sign-in");

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
            <div>
                <AVUTLogo />
            </div>
            <Tabs value={path} className="space-y-4">
                <Settings_TabsList />
                <TabsContent value="account">
                    <UserAccountSettings />
                </TabsContent>
                <TabsContent value="security">
                    <UserSecuritySettings />
                </TabsContent>
                <TabsContent value="organizations">
                    <UserOrganizationsSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
