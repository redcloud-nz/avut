/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";

import { Pub_PPEIssue_Form } from "./ppe-issue-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Paragraph } from "@/components/ui/typography";
import { List, ListItem } from "@/components/ui/list";

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
                        <Pub_PPEIssue_Form />
                    </Hermes.Section>
                    <Hermes.Section>
                        <Card>
                            <CardHeader>
                                <CardTitle>Explanation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Paragraph>
                                    This form is a work in progress and cannot
                                    yet be submitted.
                                </Paragraph>

                                <Heading level={5} className="mt-4">
                                    Development Plan
                                </Heading>
                                <List>
                                    <ListItem>
                                        v1 - Form can be submitted and the
                                        contents are emailed to the ppe manager.
                                    </ListItem>
                                    <ListItem>
                                        v2 - Form submissions are recorded in
                                        the database and can be viewed by ppe
                                        managers.
                                    </ListItem>
                                    <ListItem>
                                        v3 - Integration with D4H so that a
                                        submission of this form will generate
                                        the appropriate issued equipment records
                                        in D4H.
                                    </ListItem>
                                </List>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
