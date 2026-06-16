/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/d4h-access-tokens/--create
 */

import { Std } from "@/components/blocks/std";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_CreateD4hAccessToken_Form } from "./create-d4h-access-token";

export const metadata = {
    title: `Create D4H Access Token`,
};

export default async function AdminModule_CreateD4hAccessToken_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/--create`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    {
                        label: "D4H Access Tokens",
                        href: route("/main/[slug]/admin/d4h-access-tokens", { slug }),
                    },
                    "Create",
                ]}
            />
            <Std.ScrollContainer>
                <Card>
                    <CardHeader>
                        <CardTitle>New D4H Access Token</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AdminModule_CreateD4hAccessToken_Form organization={organization} />
                    </CardContent>
                </Card>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
