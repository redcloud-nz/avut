/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Settings_TabsList() {
    const router = useRouter();

    return (
        <TabsList>
            <TabsTrigger value="account" onClick={() => router.push("/settings/account")}>
                Account
            </TabsTrigger>
            <TabsTrigger value="security" onClick={() => router.push("/settings/security")}>
                Security
            </TabsTrigger>
            <TabsTrigger
                value="organizations"
                onClick={() => router.push("/settings/organizations")}
            >
                Organizations
            </TabsTrigger>
        </TabsList>
    );
}
