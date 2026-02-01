/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /personal
 */

import { ChevronRightIcon } from "lucide-react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";
import { Link } from "@/components/ui/link";

import * as Paths from "@/paths";

export const metadata = { title: "Personal Dashboard" };

export default async function PersonalDashboard_Page() {
    return (
        <Lexington.Root>
            <Lexington.Header breadcrumbs={["Personal Dashboard"]} />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <div className="flex flex-col items-center my-4">
                        <AVUTLogo />
                    </div>
                    <ItemGroup>
                        <Item asChild>
                            <Link to={Paths.personal.invitations}>
                                <ItemContent>
                                    <ItemTitle>Invitations</ItemTitle>
                                    <ItemDescription>
                                        View your organisation invitations.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
