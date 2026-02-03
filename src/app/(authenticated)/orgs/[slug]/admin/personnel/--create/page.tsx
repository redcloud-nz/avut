/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/--create
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { AdminModule_CreatePerson_Form } from "./create-person";

export const metadata = {
    title: `Create Person`,
};

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
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(slug).admin.personnel}
                            >
                                Personnel
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
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
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
