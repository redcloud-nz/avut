/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { ComponentProps, Suspense } from "react";

import { SidebarInset } from "@/components/ui/sidebar";
import { Lexington } from "./lexington";
import { RainbowSpinner } from "../ui/loading";

function ScrollContainer({ children, className, ...props }: ComponentProps<"main">) {
    return (
        <Suspense
            fallback={
                <main
                    className="flex items-center justify-center flex-1 p-4"
                    data-slot="scroll-container"
                    {...props}
                >
                    <RainbowSpinner />
                </main>
            }
        >
            <main
                className="relative flex-1 p-4 overflow-y-auto [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable_both-edges]"
                data-slot="scroll-container"
                {...props}
            >
                {children}
            </main>
        </Suspense>
    );
}

export const Std = {
    SidebarInset,
    ScrollContainer,
    Breadcrumbs: Lexington.Breadcrumbs,
    Navbar: Lexington.Header,
};
