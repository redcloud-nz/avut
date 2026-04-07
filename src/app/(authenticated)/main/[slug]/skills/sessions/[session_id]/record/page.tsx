/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/record
 */

"use client";

import { Suspense, use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";

import { RainbowSpinner } from "@/components/ui/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useOrganization } from "@/hooks/use-organization";

import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { SkillsModule_Session_Details_Tab } from "./details";
import { SkillsModule_Session_Personnel_Tab } from "./personnel";

export default function SkillsModule_SessionRecord_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]/record">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const { data: sessions } = useSuspenseQuery(
        trpc.skills.listSessions.queryOptions({ organizationId: organization.id }),
    );

    const session = sessions.find((s) => s.id === session_id);
    if (!session) throw new Error(`Session(${session_id}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).skills.index,
                    Paths.main(slug).skills.sessions,
                    {
                        label: session.name || session.id,
                        href: Paths.main(slug).skills.session(session_id).href,
                    },
                    "Skill Check Session Recorder",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Tabs defaultValue="details">
                        <TabsList className="w-full">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="personnel">Personnel</TabsTrigger>
                            <TabsTrigger value="skills">Skills</TabsTrigger>
                            <TabsTrigger value="by-person">Record</TabsTrigger>
                        </TabsList>

                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center aspect-square">
                                    <RainbowSpinner className="w-1/2" />
                                </div>
                            }
                        >
                            <TabsContent value="details">
                                <SkillsModule_Session_Details_Tab session={session} />
                            </TabsContent>
                            <TabsContent value="personnel">
                                <SkillsModule_Session_Personnel_Tab session={session} />
                            </TabsContent>
                            <TabsContent value="skills"></TabsContent>
                            <TabsContent value="by-person"></TabsContent>
                        </Suspense>
                    </Tabs>
                    {/* <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 min-w-100 border border-gray-300 bg-gray-200/75 rounded-sm shadow px-4 py-2 flex items-center gap-2">
                        <Button type="submit">Save</Button>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </div> */}
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
