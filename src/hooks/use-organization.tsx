/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext } from "react";

import { type OrganizationWithSettings } from "@/lib/schemas/organization";

const OrganizationContext = createContext<OrganizationWithSettings | null>(
    null,
);

export function OrganizationProvider({
    children,
    organization,
}: {
    children: ReactNode;
    organization: OrganizationWithSettings;
}) {
    return (
        <OrganizationContext.Provider value={organization}>
            {children}
        </OrganizationContext.Provider>
    );
}

export const useOrganization = (): OrganizationWithSettings => {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error(
            "useOrganization must be used within an OrganizationProvider",
        );
    }
    return context;
};
