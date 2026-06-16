/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/admin/scripts/populate-teams
 */

"use client";

import { use } from "react";
import { toast } from "sonner";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Button } from "@/components/ui/button";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

import { populateTeamsAction } from "./action";

export default function AdminScripts_PopulateTeams_Page(
    props: PageProps<`/main/[slug]/admin/scripts/populate-teams`>,
) {
    const { slug } = use(props.params);
    const organization = useOrganization();

    function runScript() {
        toast.promise(
            async () => {
                await populateTeamsAction(organization.id);
            },
            {
                loading: "Running script...",
                success: "Teams populated successfully!",
                error: (error) => `Failed to populate teams: ${error.message}`,
            },
        );
    }

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Scripts", href: route("/main/[slug]/admin/scripts", { slug }) },
                    "Populate Teams",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Populate Teams Script</Saratoga.Title>
                        <Saratoga.Actions>
                            <Button onClick={runScript}>Run Script</Button>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
