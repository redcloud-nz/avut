/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { d4hApiEffects } from "@/client/d4h-api-effects";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganization } from "@/hooks/use-organization";
import {
    D4HEquipmentItemUpdate,
    D4HEquipmentStatus,
    type D4HEquipmentItemDetail,
} from "@/lib/schemas/d4h/equipment-item";
import { trpc } from "@/trpc/client";

const FormSchema = D4HEquipmentItemUpdate.schema.required({
    isCritical: true,
    isMonitor: true,
    barcode: true,
    notes: true,
    updateNotes: true,
});

type FormData = z.infer<typeof FormSchema>;

function formValues(item: D4HEquipmentItemDetail): FormData {
    const status = D4HEquipmentStatus.schema.safeParse(item.status);
    return {
        // A RETIRED (or unknown) status can't be PATCHed back, so the select starts empty.
        status: status.success ? status.data : undefined,
        isCritical: item.isCritical,
        isMonitor: item.isMonitor,
        barcode: item.barcode ?? "",
        notes: item.notes,
        updateNotes: "",
    };
}

/**
 * Why the viewer can't edit an item on `teamTitle`, or `null` when they can: editing needs an I3
 * role holding `i3Item: ["update"]` (`hasPermission`) and D4H's Equipment UPDATE permission on the
 * item's team.
 */
export function updateEquipmentItemDisabledReason({
    hasPermission,
    canUpdateInD4H,
    teamTitle,
}: {
    hasPermission: boolean;
    canUpdateInD4H: boolean;
    teamTitle: string;
}): string | null {
    if (!hasPermission) return "Editing items needs the I3 Editor or I3 Admin role.";
    if (!canUpdateInD4H) {
        return `Your D4H account doesn't have the Equipment Update permission on ${teamTitle}.`;
    }
    return null;
}

/**
 * Edit the fields of a D4H equipment item that D4H's PATCH accepts. Opened by `?action=update`.
 *
 * With a `disabledReason`, the trigger is disabled with the reason in a tooltip, and the param
 * doesn't open the dialog.
 */
export function I3Module_UpdateEquipmentItem_Dialog({
    teamId,
    item,
    disabledReason,
}: {
    teamId: number;
    item: D4HEquipmentItemDetail;
    disabledReason: string | null;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update" && disabledReason === null;

    const form = useForm({
        resolver: zodResolver(FormSchema),
        defaultValues: formValues(item),
    });

    const mutation = useMutation(
        trpc.d4hApi.updateEquipmentItem.mutationOptions({
            meta: { effects: d4hApiEffects.updateEquipmentItem },
            onError(error) {
                console.error("Failed to update equipment item", error);
                toast.error(`Failed to update item: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Item #${item.ref} updated.`);
                handleDialogOpenChange(false);
            },
        }),
    );

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(formValues(item));
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const initial = formValues(item);

            // Send only what changed: D4H records every PATCHed field as an update.
            const update: D4HEquipmentItemUpdate = {
                status: formData.status !== initial.status ? formData.status : undefined,
                isCritical:
                    formData.isCritical !== initial.isCritical ? formData.isCritical : undefined,
                isMonitor:
                    formData.isMonitor !== initial.isMonitor ? formData.isMonitor : undefined,
                barcode: formData.barcode !== initial.barcode ? formData.barcode : undefined,
                notes: formData.notes !== initial.notes ? formData.notes : undefined,
            };

            if (Object.values(update).every((value) => value === undefined)) {
                form.setError("root", { message: "Nothing has changed." });
                return;
            }

            const updateNotes = formData.updateNotes.trim();

            mutation.mutate({
                organizationId: organization.id,
                teamId,
                itemId: item.id,
                ...update,
                updateNotes: updateNotes || undefined,
            });
        },
        (errors) => console.warn("Form validation errors:", errors),
    );

    const trigger = (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Edit item"
            disabled={disabledReason !== null}
        >
            <ObjectIcons.Edit />
        </Button>
    );

    if (disabledReason !== null) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {/* A disabled button gets no pointer events, so the wrapper takes the hover
                        and focus instead. */}
                    <span tabIndex={0}>{trigger}</span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item #{item.ref}</DialogTitle>
                    <DialogDescription>
                        Changes are saved to D4H. Brand, model, serial number and dates can only be
                        changed in D4H.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="update-equipment-item-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                name="status"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="equipment-item-status">
                                            D4H Status
                                        </FieldLabel>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger
                                                id="equipment-item-status"
                                                aria-invalid={fieldState.invalid}
                                            >
                                                <SelectValue
                                                    placeholder={D4HEquipmentStatus.label(
                                                        item.status,
                                                    )}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {D4HEquipmentStatus.schema.options.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {D4HEquipmentStatus.label(status)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="isCritical"
                                control={form.control}
                                render={({ field }) => (
                                    <Field orientation="horizontal">
                                        <Switch
                                            id="equipment-item-critical"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        <FieldLabel htmlFor="equipment-item-critical">
                                            Critical
                                        </FieldLabel>
                                    </Field>
                                )}
                            />
                            <Controller
                                name="isMonitor"
                                control={form.control}
                                render={({ field }) => (
                                    <Field orientation="horizontal">
                                        <Switch
                                            id="equipment-item-monitor"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        <FieldLabel htmlFor="equipment-item-monitor">
                                            Monitor
                                        </FieldLabel>
                                    </Field>
                                )}
                            />
                            <Controller
                                name="barcode"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="equipment-item-barcode">
                                            Barcode
                                        </FieldLabel>
                                        <Input
                                            id="equipment-item-barcode"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="notes"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="equipment-item-notes">
                                            Notes
                                        </FieldLabel>
                                        <Textarea
                                            id="equipment-item-notes"
                                            aria-invalid={fieldState.invalid}
                                            rows={5}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="updateNotes"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="equipment-item-update-notes">
                                            Update note (optional)
                                        </FieldLabel>
                                        <Textarea
                                            id="equipment-item-update-notes"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Why the item is being changed"
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            {form.formState.errors.root && (
                                <FieldError errors={[form.formState.errors.root]} />
                            )}
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-equipment-item-form"
                        status={mutation.status}
                        text={{ idle: "Update", pending: "Updating...", success: "Updated" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
