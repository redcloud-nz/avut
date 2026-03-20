/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /pub/orgs/[slug]/forms/ppe/return
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as Paths from "@/paths";

export async function generateStaticParams() {
    return [{ slug: "christchurch-em" }];
}

export const metadata = {
    title: `PPE Borrow Form`,
};

export default async function Pub_PPEBorrow_Page(
    props: PageProps<"/pub/orgs/[slug]/forms/ppe/borrow">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.pub(slug).forms.index,
                    Paths.pub(slug).forms.ppe,
                    Paths.pub(slug).forms.ppe.borrow,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton to={Paths.pub(slug).forms.ppe} />
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>PPE Borrow Form</CardTitle>
                                <CardDescription>
                                    Use this form to record PPE that has been temporarily borrowed.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
