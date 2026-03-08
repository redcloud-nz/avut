/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { SubappId } from "@/lib/subapp";

import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "./user-menu";

interface ControlBarProps {
    subappId: SubappId;
    slug: string;
}

export function ControlBar({ subappId, slug }: ControlBarProps) {
    return (
        <div
            data-slot="control-bar"
            className="fixed top-0 right-0 z-10 h-[calc(var(--header-height)-1px)] flex items-center gap-2 px-2"
        >
            {/* <NotificationsMenu /> */}
            <ModeToggle />
            <UserMenu subappId={subappId} />
        </div>
    );
}
