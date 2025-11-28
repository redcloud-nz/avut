/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ReactNode } from "react";

export function FloatingFooter({
    children,
    open = true,
}: {
    children: ReactNode;
    open?: boolean;
}) {
    return (
        <div className="fixed bottom-1 left-0 w-full flex justify-center">
            <div
                className="flex items-center gap-2 bg-primary/80 backdrop-blur-sm rounded-lg z-50 px-2 py-1 shadow-lg data-[state=closed]:hidden"
                data-state={open ? "open" : "closed"}
            >
                {children}
            </div>
        </div>
    );
}
