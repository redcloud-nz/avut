/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";

import { DisplayValue } from "@/components/ui/display-value";
import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

export function SkillPackageValue({
    skillPackageId,
    ...props
}: Omit<ComponentProps<typeof DisplayValue>, "children" | "loading"> & {
    skillPackageId: string;
}) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.skills.getPackage.queryOptions({
            orgId: organization.orgId,
            skillPackageId,
        }),
    );

    return (
        <DisplayValue loading={query.isLoading} {...props}>
            {query.data?.name ?? ""}
        </DisplayValue>
    );
}
