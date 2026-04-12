/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/record
 */

"use client";

import { Suspense, use } from "react";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";

import { RainbowSpinner } from "@/components/ui/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useOrganization } from "@/hooks/use-organization";

import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillsModule_SessionRecord_Details_Tab } from "./details";
import { SkillsModule_SessionRecord_Personnel_Tab } from "./personnel";
import { SkillsModule_SessionRecord_Skills_Tab } from "./skills";

export default function SkillsModule_SessionRecord_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]/record">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const { data: sessions } = useSuspenseQuery(
        trpc.skills.listSessions.queryOptions({ organizationId: organization.id }),
    );

    const mutation = useMutation(trpc.skills.updateSession.mutationOptions());

    const session = sessions.find((s) => s.id === session_id);
    if (!session) throw new Error(`Session(${session_id}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    {
                        label: session.name || session.id,
                        href: route("/main/[slug]/skills/sessions/[session_id]", {
                            slug,
                            session_id,
                        }),
                    },
                    "Recorder",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg" className="pt-0">
                    <Tabs defaultValue="details">
                        <div className="sticky top-0 z-5 border-b pt-2 -mx-px bg-background flex items-center gap-1 backdrop-blur-md">
                            <TabsList variant="line" className="grow">
                                <TabsTrigger value="details">Details</TabsTrigger>
                                <TabsTrigger value="personnel">Personnel</TabsTrigger>
                                <TabsTrigger value="skills">Skills</TabsTrigger>
                                <TabsTrigger value="record">Record</TabsTrigger>
                            </TabsList>
                        </div>

                        <Suspense
                            fallback={
                                <div className="w-full flex items-center justify-center aspect-square">
                                    <RainbowSpinner className="w-1/2" />
                                </div>
                            }
                        >
                            <TabsContent value="details">
                                <SkillsModule_SessionRecord_Details_Tab session={session} />
                            </TabsContent>
                            <TabsContent value="personnel">
                                <SkillsModule_SessionRecord_Personnel_Tab session={session} />
                            </TabsContent>
                            <TabsContent value="skills">
                                <SkillsModule_SessionRecord_Skills_Tab session={session} />
                            </TabsContent>
                            <TabsContent value="by-person"></TabsContent>
                        </Suspense>
                    </Tabs>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
