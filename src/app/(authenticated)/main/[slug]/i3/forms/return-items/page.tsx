/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /i3/[slug]/forms/return-items
 */

"use client";

import { Lexington } from "@/components/blocks/lexington";
import { AlertIcons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert2";
import { UnderConstruction } from "@/components/under-construction";
import { useOrganization } from "@/hooks/use-organization";
import { use } from "react";

export default function I3_Return_Page(props: PageProps<"/main/[slug]/i3/forms/return-items">) {
    const organization = useOrganization();

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "I3", href: `/main/${organization.slug}/i3` },
                    { label: "Forms" },
                    { label: "Return Items" },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <UnderConstruction />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
