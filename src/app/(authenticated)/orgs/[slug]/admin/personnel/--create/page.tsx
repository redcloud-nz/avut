/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/--create
 */

import { Lexington } from "@/components/blocks/lexington";
import { ToParentPageIcon } from "@/components/icons";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { AdminModule_CreatePerson_Form } from "./create-person";

export default async function AdminModule_PersonCreate_Page(
    props: PageProps<`/orgs/[slug]/admin/personnel/--create`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).admin.index,
                    Paths.org(slug).admin.personnel,
                    Paths.org(slug).admin.personnel.create,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Lexington.ColumnControls>
                        <Button variant="outline" asChild>
                            <Link to={Paths.org(slug).admin.personnel}>
                                <ToParentPageIcon /> Personnel
                            </Link>
                        </Button>
                    </Lexington.ColumnControls>
                    <Card>
                        <CardHeader>
                            <CardTitle>New Person Record</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AdminModule_CreatePerson_Form
                                organization={organization}
                            />
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
