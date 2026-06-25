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

import { AccountSettings } from "./account-settings";
import { OrganizationsSettings } from "./organizations-settings";
import { SecuritySettings } from "./security-settings";
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
                    <AccountSettings />
                </TabsContent>
                <TabsContent value="security">
                    <SecuritySettings />
                </TabsContent>
                <TabsContent value="organizations">
                    <OrganizationsSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
