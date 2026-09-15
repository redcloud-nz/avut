/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground/person-picker
 */

import { Std } from "@/components/blocks/std";

import { PersonPicker_Sandbox } from "./sandbox";

export default async function Playground_PersonPicker_Page() {
    return (
        <>
            <Std.Navbar breadcrumbs={["Playground", "Person picker"]} />
            <Std.ScrollContainer>
                <PersonPicker_Sandbox />
            </Std.ScrollContainer>
        </>
    );
}
