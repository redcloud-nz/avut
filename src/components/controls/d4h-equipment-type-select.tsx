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
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface D4HEquipmentTypeSelectProps extends Omit<
    D4HCatalogueSelectProps<D4HEquipmentKind>,
    "records" | "placeholder" | "organisationOnlyId" | "slotProps"
> {
    /** Only this D4H category's types are offered; none while it's `null` or `0`. */
    categoryId: number | null;
    /** The linked D4H organisation's id when only its types should be offered. */
    organisationOnlyId?: number | null;

    slotProps?: D4HCatalogueSelectProps<D4HEquipmentKind>["slotProps"] & {
        skeleton?: ComponentProps<typeof Skeleton>;
    };
}

/**
 * A select for a D4H Type (a D4H equipment kind) within one category, grouped by owner. See
 * `D4HCatalogueSelect`.
 */
export function D4HEquipmentTypeSelect({
    categoryId,
    organisationOnlyId = null,
    slotProps = {},
    ...props
}: D4HEquipmentTypeSelectProps) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
    );

    const { skeleton, ...selectSlotProps } = slotProps;

    return match(query)
        .with({ status: "pending" }, () => (
            <Skeleton className={cn("w-full h-8", skeleton?.className ?? "")} {...skeleton}>
                Fetching D4H types...
            </Skeleton>
        ))
        .with({ status: "error" }, () => (
            <Alert variant="error" className="mb-4">
                <AlertTitle>Failed to load D4H types from D4H.</AlertTitle>
            </Alert>
        ))
        .with({ status: "success" }, ({ data }) => (
            <D4HCatalogueSelect
                records={data.filter((kind) => kind.category.id === categoryId)}
                placeholder="Select a type"
                organisationOnlyId={organisationOnlyId}
                slotProps={selectSlotProps}
                {...props}
            />
        ))
        .exhaustive();
}
