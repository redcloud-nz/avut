/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

export function NavSkeleton({ length = 5 }: { length?: number }) {
    return (
        <SidebarMenu>
            {Array.from({ length }).map((_, index) => (
                <SidebarMenuItem key={index}>
                    <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}
