/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant } from "@/lib/schemas/i3-template-variant";
import { trpc } from "@/trpc/client";

import { I3Module_Template_AddVariant_Dialog } from "./add-variant";
import { I3Module_DeleteVariant_Dialog } from "./delete-variant";
import { I3Module_UpdateVariant_Dialog } from "./update-variant";

export function I3Module_Template_Variants_List({ template }: { template: I3Template }) {
    const organization = useOrganization();

    const { data: variants } = useSuspenseQuery(
        trpc.i3.listTemplateVariants.queryOptions({
            organizationId: organization.id,
            templateId: template.id,
        }),
    );

    const [variantToDelete, setVariantToDelete] = useState<I3TemplateVariant | null>(null);
    const [variantToEdit, setVariantToEdit] = useState<I3TemplateVariant | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Variants</CardTitle>
                <CardAction>
                    <Protect permissions={{ i3Template: ["update"] }}>
                        <I3Module_Template_AddVariant_Dialog template={template} />
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                <Show
                    when={variants.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No variants yet</EmptyTitle>
                                <EmptyDescription>
                                    You have not added any variants to this template yet. Click the
                                    <ObjectIcons.Create className="inline-block mx-1 size-4" />
                                    button to add a variant.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell>Brand</TableHeadCell>
                                <TableHeadCell>Model</TableHeadCell>
                                <TableHeadCell></TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {variants.map((variant, index) => {
                                return (
                                    <TableRow key={index}>
                                        <TableCell>{variant.name}</TableCell>
                                        <TableCell>
                                            {variant.d4h?.brandTitle ??
                                                `ID: ${variant.d4h?.brandId}`}
                                        </TableCell>
                                        <TableCell>
                                            {variant.d4h?.modelTitle ??
                                                `ID: ${variant.d4h?.modelId}`}
                                        </TableCell>
                                        <TableCell className="p-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setVariantToEdit(variant)}
                                            >
                                                <ObjectIcons.Edit />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setVariantToDelete(variant)}
                                            >
                                                <ObjectIcons.Delete />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Show>
            </CardContent>
            {variantToDelete && (
                <I3Module_DeleteVariant_Dialog
                    template={template}
                    variant={variantToDelete}
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) {
                            setVariantToDelete(null);
                        }
                    }}
                />
            )}
            {variantToEdit && (
                <I3Module_UpdateVariant_Dialog
                    template={template}
                    variant={variantToEdit}
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) {
                            setVariantToEdit(null);
                        }
                    }}
                />
            )}
        </Card>
    );
}
