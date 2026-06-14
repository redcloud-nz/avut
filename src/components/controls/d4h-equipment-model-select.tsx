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
import { D4HEquipmentModel } from "@/lib/schemas/d4h/equipment-model";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface D4HEquipmentModelSelectProps extends Omit<
    ComponentProps<typeof Select>,
    "children" | "onValueChange" | "value"
> {
    value: number | null;
    onChange: (value: D4HEquipmentModel) => void;
    brandId?: number;

    slotProps?: {
        skeleton?: ComponentProps<typeof Skeleton>;
        trigger?: Omit<ComponentProps<typeof SelectTrigger>, "children">;
        value?: Omit<ComponentProps<typeof SelectValue>, "children">;
        content?: Omit<ComponentProps<typeof SelectContent>, "children">;
    };
}

export function D4HEquipmentModelSelect({
    value,
    onChange,
    brandId,
    slotProps = {},
    ...props
}: D4HEquipmentModelSelectProps) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.d4hApi.listEquipmentModels.queryOptions({ organizationId: organization.id }),
    );

    function handleValueChange(value: string) {
        const modelId = parseInt(value, 10);
        const model = query.data!.find((m) => m.id === modelId);

        if (!model) {
            console.error(`Selected model with id ${modelId} not found in query results.`);
            return;
        }

        onChange(model);
    }

    return match(query)
        .with({ status: "pending" }, () => (
            <Skeleton
                className={cn("w-full h-8", slotProps.skeleton?.className ?? "")}
                {...slotProps.skeleton}
            >
                Fetching equipment models...
            </Skeleton>
        ))
        .with({ status: "error" }, () => (
            <Alert variant="error" className="mb-4">
                <AlertTitle>Failed to load equipment models from D4H.</AlertTitle>
            </Alert>
        ))
        .with({ status: "success" }, ({ data }) => (
            <Select
                value={value ? value.toString() : ""}
                onValueChange={handleValueChange}
                {...props}
            >
                <SelectTrigger {...slotProps.trigger}>
                    <SelectValue placeholder="Select a model" {...slotProps.value} />
                </SelectTrigger>
                <SelectContent {...slotProps.content}>
                    {(brandId ? data.filter((model) => model.brand.id === brandId) : data).map(
                        (model) => (
                            <SelectItem key={model.id} value={model.id.toString()}>
                                {model.title}
                            </SelectItem>
                        ),
                    )}
                </SelectContent>
            </Select>
        ))
        .exhaustive();
}
