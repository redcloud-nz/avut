/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/dev/d4h-api-test
 */

import { cacheTag } from "next/cache";

import { Lexington } from "@/components/blocks/lexington";
import { getD4hFetchClient } from "@/lib/d4h-api/client";
import { D4hWhoami } from "@/lib/d4h-api/whoami";
import { Hermes } from "@/components/blocks/hermes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchD4hWhoami() {
    "use cache";
    cacheTag("d4h");

    const fetchClient = getD4hFetchClient();
    const { data, error } = await fetchClient.GET("/v3/whoami");
    if (error) {
        console.error("D4H API Error", error);
        throw new Error(`D4H API Error`, error);
    } else return data as D4hWhoami;
}

async function fetchOrganization() {
    const fetchClient = getD4hFetchClient();

    const { data, error } = await fetchClient.GET(
        "/v3/{context}/{contextId}/organisations/{organisationId}",
        {
            params: {
                path: {
                    context: "team",
                    contextId: 6,
                    organisationId: 1,
                },
            },
        },
    );

    if (error) {
        console.error("D4H API Error", error);
        throw new Error(`D4H API Error`, error);
    } else return data as D4hWhoami;
}

export default async function Dev_D4hAPITest_Page() {
    const whoamiData = await fetchD4hWhoami();
    const organisation = await fetchOrganization();

    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["D4H API Test"]} />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        {whoamiData.members.map((member) => (
                            <Card key={member.id}>
                                <CardHeader>
                                    <CardTitle>{member.owner.title}</CardTitle>
                                </CardHeader>
                                <CardContent></CardContent>
                            </Card>
                        ))}
                    </Hermes.Section>
                    <pre>{JSON.stringify(organisation, null, 2)}</pre>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
