/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Lexington } from "@/components/blocks/lexington";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

export default function Personal_Me_Page() {
    const { data: session } = useQuery({
        queryKey: ["session"],
        queryFn: async () => {
            const { data, error } = await authClient.getSession();
            if (error) throw error;
            return data;
        },
    });
    const { data: orgs = [], isSuccess: isOrgsSuccess } = useQuery({
        queryKey: ["personal-organizations"],
        queryFn: async () => {
            const { data, error } = await authClient.organization.list();
            if (error) throw error;
            return data;
        },
    });
    const { data: a } = useQuery({
        queryKey: ["org-members"],
        queryFn: async () => {
            const { data, error } = await authClient.organization.listMembers({
                query: { organizationId: orgs[0].id },
            });
            if (error) throw error;
            return data;
        },
        enabled: isOrgsSuccess && orgs.length > 0,
    });

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["Me"]} />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <h1>My Profile</h1>
                    <h2>Session Data</h2>
                    <pre>{JSON.stringify(session, null, 2)}</pre>

                    <h2>Organizations</h2>
                    <pre>{JSON.stringify(orgs, null, 2)}</pre>

                    <h2>Members of First Organization</h2>
                    <pre>{JSON.stringify(a, null, 2)}</pre>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
