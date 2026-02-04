/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";

import { Pub_PPEIssue_Form } from "./ppe-issue-form";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export const metadata = {
    title: `PPE Issue Form`,
};

export async function generateStaticParams() {
    return [{ slug: "christchurch-em" }];
}

export default async function Pub_PPEIssue_Page(
    props: PageProps<"/pub/orgs/[slug]/forms/ppe">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.pub(slug).forms.index,
                    Paths.pub(slug).forms.ppe,
                    Paths.pub(slug).forms.ppe.issue,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton to={Paths.pub(slug).forms.ppe}>
                                PPE Forms
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>PPE Issue Form</CardTitle>
                                <CardDescription>
                                    Use this form to record the issue of PPE to
                                    an individual.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Pub_PPEIssue_Form />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
