/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { type SessionData } from "@/client/auth-queries";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { trpc } from "@/trpc/client";

/** `?action=update-name` — self-triggered (Recipe A): the trigger button lives in this dialog. */
export function UserProfile_UpdateName_Dialog({ session }: { session: SessionData }) {
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-name"] as const),
    );
    const dialogOpen = action === "update-name";

    const form = useForm({
        resolver: zodResolver(z.object({ name: z.string().min(1).max(100) })),
        defaultValues: { name: session.user.name || "" },
    });

    const mutation = useMutation({
        async mutationFn(formData: { name: string }) {
            await authClient.updateUser({ name: formData.name }, { throw: true });
        },
        onError(error) {
            console.error("Failed to update name:", error);
            toast.error(`Failed to update name: ${error.message}`);
        },
        onSuccess() {
            void queryClient.invalidateQueries(trpc.user.getSession.queryFilter());
            toast.success("Name updated");
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-name" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ name: session.user.name || "" });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) => mutation.mutate(formData),
        (errors) => console.error("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Change name">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change name</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <form id="update-name-form" onSubmit={handleSubmit}>
                        <Field data-invalid={!!form.formState.errors.name}>
                            <FieldLabel htmlFor="update-name-input">Name</FieldLabel>
                            <Input
                                id="update-name-input"
                                aria-invalid={!!form.formState.errors.name}
                                {...form.register("name")}
                            />
                            {form.formState.errors.name && (
                                <FieldError errors={[form.formState.errors.name]} />
                            )}
                        </Field>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-name-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
