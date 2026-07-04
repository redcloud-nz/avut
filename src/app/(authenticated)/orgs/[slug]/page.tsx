/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { AVUTLogo } from "@/components/art/avut-logo";
import { Argus } from "@/components/blocks/argus";

export default async function Organization_Index_Page(props: LayoutProps<"/orgs/[slug]">) {
    return (
        <Argus.Root>
            <Argus.Column>
                <AVUTLogo />
                <div>Organization Index Page</div>
            </Argus.Column>
        </Argus.Root>
    );
}
