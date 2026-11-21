/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/organization
 */

import Link from "next/link";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { route } from "@/lib/routes";
import { AdminModule_Organization_D4HCard } from "@/modules/org-admin/components/organization/d4h-org-card";
import { AdminModule_OrganizationMenu } from "@/modules/org-admin/components/organization/organization-menu";
import { getOrganizationBySlug } from "@/server/cache/organization";

export default async function AdminModule_Organization_Page(
    props: PageProps<`/orgs/[slug]/admin/organization`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    "Organization",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Organisation</Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_OrganizationMenu slug={slug} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <RecordCard
                                label="Organisation"
                                action={
                                    <Protect permissions={{ organization: ["update"] }}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Update organisation"
                                            asChild
                                        >
                                            <Link
                                                href={route(
                                                    "/orgs/[slug]/admin/organization/--update",
                                                    { slug },
                                                )}
                                            >
                                                <ObjectIcons.Edit />
                                            </Link>
                                        </Button>
                                    </Protect>
                                }
                            >
                                <CardContent>
                                    <DataList>
                                        <RecordCardId
                                            label="Organisation ID"
                                            id={organization.id}
                                        />
                                        <DataItem>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{organization.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Slug</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {organization.slug}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </RecordCard>
                            <AdminModule_Organization_D4HCard />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
