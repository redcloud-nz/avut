/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

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

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-variant", "delete-variant"] as const),
    );
    const [variantId, setVariantId] = useQueryState("variantId", parseAsString);
    const activeVariant = variants.find((v) => v.id === variantId) ?? null;

    function openVariantAction(next: "update-variant" | "delete-variant", id: string) {
        void setVariantId(id, { history: "push" });
        void setAction(next, { history: "push" });
    }
    function closeVariantAction() {
        void setAction(null, { history: "replace" });
        void setVariantId(null, { history: "replace" });
    }

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
                                                onClick={() =>
                                                    openVariantAction("update-variant", variant.id)
                                                }
                                            >
                                                <ObjectIcons.Edit />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    openVariantAction("delete-variant", variant.id)
                                                }
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
            {activeVariant && (
                <I3Module_UpdateVariant_Dialog
                    template={template}
                    variant={activeVariant}
                    open={action === "update-variant"}
                    onOpenChange={(open) => (open ? undefined : closeVariantAction())}
                />
            )}
            {activeVariant && (
                <I3Module_DeleteVariant_Dialog
                    template={template}
                    variant={activeVariant}
                    open={action === "delete-variant"}
                    onOpenChange={(open) => (open ? undefined : closeVariantAction())}
                />
            )}
        </Card>
    );
}
