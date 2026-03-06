/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { D4hPpeTemplate } from "@/lib/schemas/d4h-ppe-template";
import { trpc } from "@/trpc/client";
import { useOrganization } from "./use-organization";

/**
 * Fetches a D4H PPE template by its ID using TRPC and React Query.
 * @param templateId The ID of the template to fetch.
 * @returns The template with the specified ID.
 */
export function useD4hPpeTemplate(templateId: string): D4hPpeTemplate {
    const organization = useOrganization();

    const { data: templates } = useSuspenseQuery(
        trpc.d4hPpe.listTemplates.queryOptions({
            organizationId: organization.id,
        }),
    );

    const template = templates.find((t) => t.id === templateId);
    if (!template) throw new Error(`D4hPpeTemplate(${templateId}) not found`);

    return template;
}
