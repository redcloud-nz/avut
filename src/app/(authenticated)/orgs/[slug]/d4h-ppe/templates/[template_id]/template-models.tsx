/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useState } from "react";

import { useQueries, useSuspenseQueries } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { D4hPpeTemplateId } from "@/lib/schemas/d4h-ppe-template";

import { trpc } from "@/trpc/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function D4hPPEModule_Template_Models_List({
    templateId,
}: {
    templateId: D4hPpeTemplateId;
}) {
    const organization = useOrganization();

    const [{ data: templates }, { data: brands }, { data: models }] =
        useSuspenseQueries({
            queries: [
                trpc.d4hPpe.listTemplates.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.d4hApi.listEquipmentBrands.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.d4hApi.listEquipmentModels.queryOptions({
                    organizationId: organization.id,
                }),
            ],
        });

    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const template = templates.find((t) => t.id === templateId);
    if (!template) throw new Error("Template not found");

    const templateModels = models.filter((model) =>
        template.d4hModelIds.includes(model.id),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Models</CardTitle>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ d4hPpeTemplate: ["update"] }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            tooltip="Add model"
                            onClick={() => setAddDialogOpen(true)}
                        >
                            <ObjectIcons.Create />
                        </Button>
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                <Show
                    when={templateModels.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No models yet</EmptyTitle>
                                <EmptyDescription>
                                    You have not added any models to this
                                    template yet. Click the
                                    <ObjectIcons.Create className="inline-block mx-1 size-4" />
                                    button to add a model.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Brand</TableHeadCell>
                                <TableHeadCell>Model</TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templateModels.map((model) => {
                                const brand = brands.find(
                                    (b) => b.id === model.brand.id,
                                );
                                return (
                                    <TableRow key={model.id}>
                                        <TableHeadCell>
                                            {brand?.title ??
                                                `ID: ${model.brand.id}`}
                                        </TableHeadCell>
                                        <TableHeadCell>
                                            {model.title}
                                        </TableHeadCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Show>
            </CardContent>

            <AddModel_Dialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
            />
        </Card>
    );
}

function AddModel_Dialog({ ...props }: DialogProps) {
    const organization = useOrganization();

    const [{ data: brands }, { data: models }] = useQueries({
        queries: [
            trpc.d4hApi.listEquipmentBrands.queryOptions({
                organizationId: organization.id,
            }),
            trpc.d4hApi.listEquipmentModels.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const form = useForm({
        resolver: zodResolver(
            z.object({
                brandId: z.number(),
                modelId: z.number(),
            }),
        ),
    });

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Model to Template</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Controller
                        control={form.control}
                        name="brandId"
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel>Brand</FieldLabel>
                                <Select
                                    value={(field.value || "") + ""}
                                    onValueChange={(newValue) =>
                                        field.onChange(parseInt(newValue))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a brand" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {brands?.map((brand) => (
                                            <SelectItem
                                                key={brand.id}
                                                value={brand.id.toString()}
                                            >
                                                {brand.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
