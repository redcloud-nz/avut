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
import { Saratoga } from "@/components/blocks/saratoga";

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
            <div
                className="relative flex-1 p-4 overflow-y-auto [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable_both-edges]"
                data-slot="scroll-container"
            >
                <Saratoga.Root>
                    <AdminModule_PersonnelList organization={organization} />
                </Saratoga.Root>
            </div>
        </Lexington.Root>
    );
}
