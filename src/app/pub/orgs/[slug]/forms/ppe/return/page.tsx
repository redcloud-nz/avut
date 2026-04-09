/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Route } from "next";
import { route } from "@/lib/routes";

export async function generateStaticParams() {
    return [{ slug: "christchurch-em" }];
}

export const metadata = {
    title: `PPE Return Form`,
};

export default async function Pub_PPEReturn_Page(
    props: PageProps<"/pub/orgs/[slug]/forms/ppe/return">,
) {
    const { slug } = await props.params;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Forms", href: `/pub/orgs/${slug}/forms` as Route },
                    { label: "PPE", href: route("/pub/orgs/[slug]/forms/ppe", { slug }) },
                    "Return",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                href={route("/pub/orgs/[slug]/forms/ppe", { slug })}
                            />
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>PPE Return Form</CardTitle>
                                <CardDescription>
                                    Use the form to return issued PPE items.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
