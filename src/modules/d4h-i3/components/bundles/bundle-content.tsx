/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HTeamPickerDialog } from "@/components/d4h/team-picker-dialog";
import { HelpButton } from "@/components/docs/help-button";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";

import { D4HI3Module_Bundle_Lines } from "./bundle-lines";
import { D4HI3Module_Bundle_Menu } from "./bundle-menu";
import { D4HI3Module_UpdateBundle_Dialog } from "./update-bundle";

/** A bundle's page. Reads no D4H data, so it works for an organization with no D4H token. */
export function D4HI3Module_Bundle_Content({ bundleId }: { bundleId: I3BundleId }) {
    const organization = useOrganization();
    const slug = organization.slug;

    const {
        data: { bundle, lines },
    } = useSuspenseQuery(
        trpc.i3Bundles.getBundle.queryOptions({ organizationId: organization.id, bundleId }),
    );

    // The menu hosts the recover dialog; the banner's button is a second trigger for it.
    const [, setAction] = useQueryState("action", parseAsStringLiteral(["recover"] as const));

    const deleted = bundle.status === "Deleted";

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Bundles", href: route("/orgs/[slug]/d4h-i3/bundles", { slug }) },
                    bundle.name,
                ]}
                actions={<HelpButton id="d4h-i3/bundles" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title
                            badges={
                                bundle.status !== "Active" && (
                                    <Badge variant="outline">{bundle.status}</Badge>
                                )
                            }
                        >
                            {bundle.name}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            {!deleted && (
                                // Always the picker, never a one-team shortcut: knowing the teams
                                // would need a D4H read, and this page has to work without a token.
                                // The picker only queries D4H once it's opened.
                                <Protect
                                    permissions={{ d4hEquipment: ["view"], i3Item: ["issue"] }}
                                >
                                    <D4HTeamPickerDialog
                                        label="Compare with a team"
                                        section={(teamId) =>
                                            route(
                                                "/orgs/[slug]/d4h-i3/bundles/[bundle_id]/teams/[d4h_team_id]",
                                                {
                                                    slug,
                                                    bundle_id: bundle.id,
                                                    d4h_team_id: String(teamId),
                                                },
                                            )
                                        }
                                    />
                                </Protect>
                            )}
                            <D4HI3Module_Bundle_Menu bundle={bundle} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    {deleted && (
                        <Alert variant="warning">
                            <AlertTitle>This bundle is in the Rubbish bin</AlertTitle>
                            <AlertDescription>Recover it to change it.</AlertDescription>
                            <Protect permissions={{ i3Bundle: ["delete"] }}>
                                <AlertAction>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAction("recover", { history: "push" })}
                                    >
                                        <ObjectIcons.Recover /> Recover
                                    </Button>
                                </AlertAction>
                            </Protect>
                        </Alert>
                    )}

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <RecordCard
                                label="I3 Bundle"
                                updatedAt={bundle.updatedAt}
                                action={
                                    !deleted && (
                                        <Protect permissions={{ i3Bundle: ["update"] }}>
                                            <D4HI3Module_UpdateBundle_Dialog bundle={bundle} />
                                        </Protect>
                                    )
                                }
                            >
                                <CardContent>
                                    <DataList>
                                        <RecordCardId label="Bundle ID" id={bundle.id} />
                                        <DataItem>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{bundle.name}</DataItemValue>
                                        </DataItem>
                                        {bundle.description && (
                                            <DataItem>
                                                <DataItemTitle>Description</DataItemTitle>
                                                <DataItemValue>{bundle.description}</DataItemValue>
                                            </DataItem>
                                        )}
                                    </DataList>
                                </CardContent>
                            </RecordCard>
                            <D4HI3Module_Bundle_Lines bundle={bundle} lines={lines} />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
