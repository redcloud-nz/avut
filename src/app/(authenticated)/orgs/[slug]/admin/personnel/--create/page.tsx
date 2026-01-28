/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/--create
 */

import { Lexington } from "@/components/blocks/lexington";
import { ToParentPageIcon } from "@/components/icons";
import { Link } from "@/components/ui/link";
import { S2_Button } from "@/components/ui/s2-button";
import {
    S2_Card,
    S2_CardContent,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";

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
                        <S2_Button variant="outline" asChild>
                            <Link to={Paths.org(slug).admin.personnel}>
                                <ToParentPageIcon /> Personnel
                            </Link>
                        </S2_Button>
                    </Lexington.ColumnControls>
                    <S2_Card>
                        <S2_CardHeader>
                            <S2_CardTitle>New Person Record</S2_CardTitle>
                        </S2_CardHeader>
                        <S2_CardContent>
                            <AdminModule_CreatePerson_Form
                                organization={organization}
                            />
                        </S2_CardContent>
                    </S2_Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
