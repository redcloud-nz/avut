/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--select
 */

import { headers } from "next/headers";

import { auth } from "@/server/auth";

export const metadata = { title: "Select Organization" };

export default async function OrganizationSelect_Page() {
    const session = await auth.api.getSession({ headers: await headers() });

    return <div>Select your organization</div>;
}
