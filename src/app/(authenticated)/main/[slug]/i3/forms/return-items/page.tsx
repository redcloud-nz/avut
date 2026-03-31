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
import { useOrganization } from "@/hooks/use-organization";
import { useTranslations } from "next-intl";
import { use } from "react";

export default function I3_Return_Page(props: PageProps<"/main/[slug]/i3/forms/return-items">) {
    const organization = useOrganization();
    const t = useTranslations("I3Module");

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: t("title"), href: `/main/${organization.slug}/i3` },
                    {
                        label: t("returnItems"),
                        href: `/main/${organization.slug}/i3/forms/return-items`,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md"></Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
