/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /pub/main/[slug]/forms/ppe/inspect
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import * as Paths from "@/paths";

export async function generateStaticParams() {
    return [{ slug: "christchurch-em" }];
}

export const metadata = {
    title: `PPE Return Form`,
};

export default async function Pub_PPEInspect_Page(
    props: PageProps<"/pub/main/[slug]/forms/ppe/inspect">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.pub(slug).forms.index,
                    Paths.pub(slug).forms.ppe,
                    Paths.pub(slug).forms.ppe.inspect,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton to={Paths.pub(slug).forms.ppe}>
                                PPE Forms
                            </Hermes.BackButton>
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>PPE Return Form</CardTitle>
                                <CardDescription>
                                    Use this form to record an inspection of the
                                    PPE items issued to an individual.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
