/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useId, type RefObject } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { i3Effects } from "@/client/i3-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { UserNameFieldValue } from "@/modules/d4h-i3/components/form-shared";
import { trpc } from "@/trpc/client";

const FormSchema = z.object({ comments: z.string() });

/**
 * Return a single item from its holder, queueing a D4H retire task. Opened by `?action=return`
 * from the Return item that `D4HI3Module_ItemReturn_MenuAction` adds to the D4H item page's Actions
 * menu.
 *
 * Same result as the Return form (the checks, the retire task with its note, the audit log), but
 * no email and no draft. The param doesn't open the dialog unless `canReturn` (the viewer may
 * return the item, it's issued to a member, and it isn't already Returned), so a hand-typed URL
 * does nothing.
 *
 * Its opener is a menu item, gone by the time the dialog closes, so pass `returnFocusRef` (the
 * menu's button) for focus to land on instead.
 */
export function D4HI3Module_ReturnEquipmentItem_Dialog({
    teamId,
    itemId,
    itemLabel,
    holder,
    canReturn,
    returnFocusRef,
}: {
    teamId: number;
    itemId: number;
    /** `#<ref> <kind title>`. */
    itemLabel: string;
    /** The member the item is issued to; `name` is `null` when they aren't in the member list. */
    holder: { id: number; name: string | null };
    canReturn: boolean;
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus(returnFocusRef);

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["return"] as const));
    const dialogOpen = action === "return" && canReturn;

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(FormSchema),
        defaultValues: { comments: "" },
    });

    const mutation = useMutation(
        trpc.i3.returnItem.mutationOptions({
            meta: { effects: i3Effects.returnItem },
            onError(error) {
                console.error("Failed to return equipment item", error);
                toast.error(`Failed to return item: ${error.message}`);
            },
            onSuccess({ returned, failures }) {
                if (returned > 0) {
                    toast.success("Returned. A retire task is queued.");
                } else {
                    toast.warning(`${itemLabel} wasn't returned.`, {
                        description: failures.join("\n"),
                    });
                }
                handleDialogOpenChange(false);
            },
        }),
    );

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "return" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ comments: "" });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        ({ comments }) =>
            mutation.mutate({
                organizationId: organization.id,
                teamId,
                itemId,
                comments,
            }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Return {itemLabel}</DialogTitle>
                    <DialogDescription>
                        Queues a D4H task to retire the item. Nothing is changed in D4H until the
                        task is applied there.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id={formId} onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel>Returned by</FieldLabel>
                                <div>{holder.name ?? `Member #${holder.id}`}</div>
                            </Field>
                            <Field>
                                <FieldLabel>Received by</FieldLabel>
                                <UserNameFieldValue />
                            </Field>
                            <Controller
                                name="comments"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="return-equipment-item-comments">
                                            Comments (optional)
                                        </FieldLabel>
                                        <Textarea
                                            id="return-equipment-item-comments"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form={formId}
                        status={mutation.status}
                        text={{ idle: "Return", pending: "Returning...", success: "Returned" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
