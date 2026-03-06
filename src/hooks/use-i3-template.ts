/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { I3Template } from "@/lib/schemas/i3-template";
import { trpc } from "@/trpc/client";
import { useOrganization } from "./use-organization";

/**
 * Fetches a D4H PPE template by its ID using TRPC and React Query.
 * @param i3TemplateId The ID of the template to fetch.
 * @returns The template with the specified ID.
 */
export function useI3Template(i3TemplateId: string): I3Template {
    const organization = useOrganization();

    const { data: templates } = useSuspenseQuery(
        trpc.i3.listTemplates.queryOptions({
            organizationId: organization.id,
        }),
    );

    const template = templates.find((t) => t.id === i3TemplateId);
    if (!template) throw new Error(`I3Template(${i3TemplateId}) not found`);

    return template;
}
