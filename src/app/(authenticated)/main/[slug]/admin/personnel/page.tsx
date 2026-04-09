/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/personnel
 */

import { Lexington } from "@/components/blocks/lexington";

import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

import { AdminModule_PersonnelList } from "./personnel-list";

export const metadata = {
    title: `Personnel`,
};

export default async function AdminModule_PersonnelList_Page(
    props: PageProps<"/main/[slug]/admin/personnel">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Personnel", href: route("/main/[slug]/admin/personnel", { slug }) },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <AdminModule_PersonnelList organization={organization} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
