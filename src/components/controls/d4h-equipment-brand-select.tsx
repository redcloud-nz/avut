/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { ComponentProps } from "react";
import { match } from "ts-pattern";

import { useQuery } from "@tanstack/react-query";

import { Alert, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { D4HEquipmentBrand } from "@/lib/schemas/d4h/equipment-brand";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface D4HEquipmentBrandSelectProps extends Omit<
    ComponentProps<typeof Select>,
    "children" | "onValueChange" | "value"
> {
    value: number | null;
    onChange: (value: D4HEquipmentBrand) => void;

    slotProps?: {
        skeleton?: ComponentProps<typeof Skeleton>;
        trigger?: Omit<ComponentProps<typeof SelectTrigger>, "children">;
        value?: Omit<ComponentProps<typeof SelectValue>, "children">;
        content?: Omit<ComponentProps<typeof SelectContent>, "children">;
    };
}

export function D4HEquipmentBrandSelect({
    value,
    onChange,
    slotProps = {},
    ...props
}: D4HEquipmentBrandSelectProps) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.d4hApi.listEquipmentBrands.queryOptions({ organizationId: organization.id }),
    );

    function handleValueChange(value: string) {
        const brandId = parseInt(value, 10);
        const brand = query.data!.find((b) => b.id === brandId);

        if (!brand) {
            console.error(`Selected brand with id ${brandId} not found in query results.`);
            return;
        }

        onChange(brand);
    }

    return match(query)
        .with({ status: "pending" }, () => (
            <Skeleton
                className={cn("w-full h-8", slotProps.skeleton?.className ?? "")}
                {...slotProps.skeleton}
            >
                Fetching equipment brands...
            </Skeleton>
        ))
        .with({ status: "error" }, () => (
            <Alert variant="error" className="mb-4">
                <AlertTitle>Failed to load equipment brands from D4H.</AlertTitle>
            </Alert>
        ))
        .with({ status: "success" }, ({ data }) => (
            <Select
                value={value ? value.toString() : ""}
                onValueChange={handleValueChange}
                {...props}
            >
                <SelectTrigger {...slotProps.trigger}>
                    <SelectValue placeholder="Select a brand" {...slotProps.value} />
                </SelectTrigger>
                <SelectContent {...slotProps.content}>
                    {data.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id.toString()}>
                            {brand.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        ))
        .exhaustive();
}
