/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/scripts/populate-teams
 */

"use client";

import { use } from "react";
import { toast } from "sonner";

import { Lexington } from "@/components/blocks/lexington";
import { Button } from "@/components/ui/button";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { populateTeamsAction } from "./action";

export default function AdminScripts_PopulateTeams_Page(
    props: PageProps<`/orgs/[slug]/admin/scripts/populate-teams`>,
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
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    "Scripts",
                    "Populate Teams",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <div className="font-semibold">
                            Populate Teams Script
                        </div>
                        <Button onClick={runScript}>Run Script</Button>
                    </div>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
