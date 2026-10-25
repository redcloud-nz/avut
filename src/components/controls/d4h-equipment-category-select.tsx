/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { ComponentProps } from "react";
import { match } from "ts-pattern";

import { useQuery } from "@tanstack/react-query";

import {
    D4HCatalogueSelect,
    D4HCatalogueSelectProps,
} from "@/components/controls/d4h-catalogue-select";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/use-organization";
import { D4HEquipmentCategory } from "@/lib/schemas/d4h/equipment-category";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface D4HEquipmentCategorySelectProps extends Omit<
    D4HCatalogueSelectProps<D4HEquipmentCategory>,
    "records" | "placeholder" | "organisationOnlyId" | "slotProps"
> {
    /** The linked D4H organisation's id when only its categories should be offered. */
    organisationOnlyId?: number | null;

    slotProps?: D4HCatalogueSelectProps<D4HEquipmentCategory>["slotProps"] & {
        skeleton?: ComponentProps<typeof Skeleton>;
    };
}

/** A select for a D4H equipment category, grouped by owner. See `D4HCatalogueSelect`. */
export function D4HEquipmentCategorySelect({
    organisationOnlyId = null,
    slotProps = {},
    ...props
}: D4HEquipmentCategorySelectProps) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
    );

    const { skeleton, ...selectSlotProps } = slotProps;

    return match(query)
        .with({ status: "pending" }, () => (
            <Skeleton className={cn("w-full h-8", skeleton?.className ?? "")} {...skeleton}>
                Fetching equipment categories...
            </Skeleton>
        ))
        .with({ status: "error" }, () => (
            <Alert variant="error" className="mb-4">
                <AlertTitle>Failed to load equipment categories from D4H.</AlertTitle>
            </Alert>
        ))
        .with({ status: "success" }, ({ data }) => (
            <D4HCatalogueSelect
                records={data}
                placeholder="Select a category"
                organisationOnlyId={organisationOnlyId}
                slotProps={selectSlotProps}
                {...props}
            />
        ))
        .exhaustive();
}
