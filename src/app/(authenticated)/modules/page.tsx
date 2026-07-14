/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /modules
 */

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Argus } from "@/components/blocks/argus";
import { Modules } from "@/lib/modules";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";

export default async function Organization_Index_Page() {
    const SkillTrackIcon = Modules.skills.icon;

    return (
        <Argus.Root>
            <Argus.Column>
                <AVUTLogo />
                <h1 className="text-2xl font-bold">Modules</h1>
                <ItemGroup>
                    <Item variant="outline" className="bg-background" asChild>
                        <Link href="/orgs/--select-org?module=skill-track">
                            <ItemMedia>
                                <SkillTrackIcon />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle>Skill Track</ItemTitle>
                                <ItemDescription>
                                    Track and manage skills within your organization.
                                </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ChevronRightIcon className="size-4" />
                            </ItemActions>
                        </Link>
                    </Item>
                </ItemGroup>
            </Argus.Column>
        </Argus.Root>
    );
}
