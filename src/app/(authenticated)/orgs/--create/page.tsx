/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/--create
 */

import { Argus } from "@/components/blocks/argus";
import { CreateOrganization_Card } from "@/components/cards/create-org";

export default async function OrganizationCreate_Page() {
    return (
        <Argus.Root>
            <Argus.Column>
                <Argus.AppLogo />
                <CreateOrganization_Card />
            </Argus.Column>
        </Argus.Root>
    );
}
