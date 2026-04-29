/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/record
 */

"use client";

import { Suspense, use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { RainbowSpinner } from "@/components/ui/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useOrganization } from "@/hooks/use-organization";

import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillsModule_SessionRecord_ByPerson_Tab } from "./by-person";
import { SkillsModule_SessionRecord_BySkill_Tab } from "./by-skill";
import { SkillsModule_SessionRecord_Details_Tab } from "./details";

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
                <Lexington.Column width="lg">
                    <Tabs defaultValue="details">
                        <Hermes.Header>
                            <Hermes.BackButton
                                href={route("/main/[slug]/skills/sessions/[session_id]", {
                                    slug,
                                    session_id,
                                })}
                            />
                            <TabsList variant="line" className="w-full">
                                <TabsTrigger value="details">Details</TabsTrigger>

                                <TabsTrigger value="by-person">By Person</TabsTrigger>
                                <TabsTrigger value="by-skill">By Skill</TabsTrigger>
                            </TabsList>
                        </Hermes.Header>

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
                            <TabsContent value="by-person">
                                <SkillsModule_SessionRecord_ByPerson_Tab session={session} />
                            </TabsContent>
                            <TabsContent value="by-skill">
                                <SkillsModule_SessionRecord_BySkill_Tab session={session} />
                            </TabsContent>
                        </Suspense>
                    </Tabs>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
