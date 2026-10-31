/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { D4HEquipmentBrandLink } from "@/components/entity-links/d4h-equipment-brand-link";
import { D4HEquipmentModelLink } from "@/components/entity-links/d4h-equipment-model-link";
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
import { variantUsesOtherRecords } from "@/lib/i3-template-fit";
import { I3Template } from "@/lib/schemas/i3-template";
import { useOrganisationOnlyId } from "@/modules/d4h-i3/lib/use-organisation-only-id";
import { trpc } from "@/trpc/client";

import { D4HI3Module_Template_AddVariant_Dialog } from "./add-variant";
import { D4HI3Module_DeleteVariant_Dialog } from "./delete-variant";
import { D4HI3Module_OtherRecords_Marker } from "./other-records-flag";
import { D4HI3Module_UpdateVariant_Dialog } from "./update-variant";

export function D4HI3Module_Template_Variants_List({ template }: { template: I3Template }) {
    const organization = useOrganization();

    const { data: variants } = useSuspenseQuery(
        trpc.i3.listTemplateVariants.queryOptions({
            organizationId: organization.id,
            templateId: template.id,
        }),
    );

    // Not suspending: owners and the flag are extras, so a D4H failure leaves them out rather
    // than blanking the variants.
    const { data: brands } = useQuery(
        trpc.d4hApi.listEquipmentBrands.queryOptions({ organizationId: organization.id }),
    );
    const { data: models } = useQuery(
        trpc.d4hApi.listEquipmentModels.queryOptions({ organizationId: organization.id }),
    );
    const organisationOnlyId = useOrganisationOnlyId();

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
                        <D4HI3Module_Template_AddVariant_Dialog template={template} />
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
                                const brandOwner = brands?.find(
                                    (b) => b.id === variant.d4h?.brandId,
                                )?.owner;
                                const modelOwner = models?.find(
                                    (m) => m.id === variant.d4h?.modelId,
                                )?.owner;
                                const flagged =
                                    organisationOnlyId != null &&
                                    brands != null &&
                                    models != null &&
                                    variantUsesOtherRecords(
                                        variant.d4h,
                                        { brands, models },
                                        organisationOnlyId,
                                    );
                                return (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1.5">
                                                {variant.name}
                                                {flagged && <D4HI3Module_OtherRecords_Marker />}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {variant.d4h ? (
                                                <D4HEquipmentBrandLink
                                                    brand={{
                                                        id: variant.d4h.brandId,
                                                        title: variant.d4h.brandTitle,
                                                        owner: brandOwner,
                                                    }}
                                                />
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {variant.d4h ? (
                                                <D4HEquipmentModelLink
                                                    model={{
                                                        id: variant.d4h.modelId,
                                                        title: variant.d4h.modelTitle,
                                                        brand: { id: variant.d4h.brandId },
                                                        owner: modelOwner,
                                                    }}
                                                />
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell className="p-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Update ${variant.name}`}
                                                onClick={() =>
                                                    openVariantAction("update-variant", variant.id)
                                                }
                                            >
                                                <ObjectIcons.Edit />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Delete ${variant.name}`}
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
                <D4HI3Module_UpdateVariant_Dialog
                    template={template}
                    variant={activeVariant}
                    open={action === "update-variant"}
                    onOpenChange={(open) => (open ? undefined : closeVariantAction())}
                />
            )}
            {activeVariant && (
                <D4HI3Module_DeleteVariant_Dialog
                    template={template}
                    variant={activeVariant}
                    open={action === "delete-variant"}
                    onOpenChange={(open) => (open ? undefined : closeVariantAction())}
                />
            )}
        </Card>
    );
}
