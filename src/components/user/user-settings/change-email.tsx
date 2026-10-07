/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    changeEmailMutationOptions,
    requestEmailChangeMutationOptions,
    sendEmailVerificationOtp,
    sendEmailVerificationOtpMutationOptions,
    type SessionData,
} from "@/client/auth-queries";
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
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { trpc } from "@/trpc/client";

type ChangeEmailStep =
    | { name: "start" }
    | { name: "verify-current" }
    | { name: "verify-new"; newEmail: string };

/** `?action=change-email` — self-triggered (Recipe A): the trigger button lives in this dialog. */
export function UserProfile_ChangeEmail_Dialog({ session }: { session: SessionData }) {
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["change-email"] as const),
    );
    const dialogOpen = action === "change-email";

    const [step, setStep] = useState<ChangeEmailStep>({ name: "start" });
    const [newCode, setNewCode] = useState("");

    const changeEmailForm = useForm({
        resolver: zodResolver(
            z.object({
                newEmail: z
                    .email()
                    .refine(
                        (value) => value.trim().toLowerCase() !== session.user.email?.toLowerCase(),
                        "New email must be different from your current email.",
                    ),
                code: z.string().length(6, "Enter the 6-digit code we sent you."),
            }),
        ),
        defaultValues: { newEmail: "", code: "" },
    });

    const sendCurrentOtpMutation = useMutation({
        ...sendEmailVerificationOtpMutationOptions(),
        onSuccess() {
            setStep({ name: "verify-current" });
        },
    });

    const requestEmailChangeMutation = useMutation({
        ...requestEmailChangeMutationOptions(),
        onSuccess(_, { newEmail }) {
            // Don't reset changeEmailForm here - the code/new-email fields stay visible
            // (disabled) as a record of what was already confirmed.
            setStep({ name: "verify-new", newEmail });
        },
    });

    const changeEmailMutation = useMutation({
        ...changeEmailMutationOptions(),
        async onSuccess() {
            // /email-otp/change-email isn't in the client's atomListeners, so the shared
            // session store won't auto-refresh on its own - explicitly invalidate it so this
            // dialog (and the rest of the UI, e.g. nav) picks up the new email immediately.
            void queryClient.invalidateQueries(trpc.user.getSession.queryFilter());
            toast.success("Your email address has been updated.");
            restart();
            handleDialogOpenChange(false);
        },
    });

    function restart() {
        sendCurrentOtpMutation.reset();
        requestEmailChangeMutation.reset();
        changeEmailMutation.reset();
        changeEmailForm.reset();
        setNewCode("");
        setStep({ name: "start" });
    }

    function resendCurrentOtp() {
        void sendEmailVerificationOtp(session.user.email!)
            .then(() => toast("Verification code resent to your current email."))
            .catch((error: Error) => toast.error(error.message));
    }

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "change-email" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) restart();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Change email">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>Change email</DialogTitle>
                    <DialogDescription>
                        Update the email address associated with your account.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Current Email</FieldLabel>
                            <Input disabled type="email" value={session.user.email} />
                            {step.name === "start" && (
                                <FieldDescription>
                                    We&apos;ll send a verification code to this address to confirm
                                    it&apos;s you.
                                </FieldDescription>
                            )}
                        </Field>
                        {step.name === "start" && sendCurrentOtpMutation.isError && (
                            <FieldError
                                errors={[sendCurrentOtpMutation.error as { message?: string }]}
                            />
                        )}

                        {step.name !== "start" && (
                            <>
                                <FieldSeparator />
                                <Controller
                                    control={changeEmailForm.control}
                                    name="code"
                                    render={({ field, fieldState }) => (
                                        <Field
                                            orientation="responsive"
                                            data-invalid={fieldState.invalid}
                                        >
                                            <FieldLabel htmlFor="current-email-code">
                                                Verification Code
                                            </FieldLabel>
                                            <InputOTP
                                                id="current-email-code"
                                                maxLength={6}
                                                value={field.value}
                                                onChange={field.onChange}
                                                pattern={REGEXP_ONLY_DIGITS}
                                                disabled={
                                                    step.name === "verify-new" ||
                                                    requestEmailChangeMutation.isPending
                                                }
                                                aria-invalid={fieldState.invalid}
                                            >
                                                <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                                                    <InputOTPSlot index={0} />
                                                    <InputOTPSlot index={1} />
                                                    <InputOTPSlot index={2} />
                                                    <InputOTPSlot index={3} />
                                                    <InputOTPSlot index={4} />
                                                    <InputOTPSlot index={5} />
                                                </InputOTPGroup>
                                            </InputOTP>
                                            {step.name === "verify-current" && (
                                                <FieldDescription>
                                                    Enter the 6-digit code we sent to your current
                                                    email ({session.user.email}).
                                                    <br />
                                                    Didn&apos;t receive it?{" "}
                                                    <a onClick={resendCurrentOtp}>Resend</a>
                                                </FieldDescription>
                                            )}
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    control={changeEmailForm.control}
                                    name="newEmail"
                                    render={({ field, fieldState }) => (
                                        <Field
                                            orientation="responsive"
                                            data-invalid={fieldState.invalid}
                                        >
                                            <FieldLabel htmlFor="user-new-email">
                                                New Email
                                            </FieldLabel>
                                            <Input
                                                id="user-new-email"
                                                type="email"
                                                aria-invalid={fieldState.invalid}
                                                disabled={
                                                    step.name === "verify-new" ||
                                                    requestEmailChangeMutation.isPending
                                                }
                                                {...field}
                                            />
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                {step.name === "verify-current" &&
                                    requestEmailChangeMutation.isError && (
                                        <FieldError
                                            errors={[
                                                requestEmailChangeMutation.error as {
                                                    message?: string;
                                                },
                                            ]}
                                        />
                                    )}
                            </>
                        )}

                        {step.name === "verify-new" && (
                            <>
                                <FieldSeparator />
                                <Field orientation="responsive">
                                    <FieldLabel>Verification Code</FieldLabel>
                                    <InputOTP
                                        maxLength={6}
                                        value={newCode}
                                        onChange={setNewCode}
                                        pattern={REGEXP_ONLY_DIGITS}
                                        disabled={changeEmailMutation.isPending}
                                    >
                                        <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                                            <InputOTPSlot index={0} />
                                            <InputOTPSlot index={1} />
                                            <InputOTPSlot index={2} />
                                            <InputOTPSlot index={3} />
                                            <InputOTPSlot index={4} />
                                            <InputOTPSlot index={5} />
                                        </InputOTPGroup>
                                    </InputOTP>
                                    <FieldDescription>
                                        Enter the 6-digit code we sent to your new email address (
                                        {step.newEmail}).
                                    </FieldDescription>
                                </Field>
                                {changeEmailMutation.isError && (
                                    <FieldError
                                        errors={[changeEmailMutation.error as { message?: string }]}
                                    />
                                )}
                            </>
                        )}
                    </FieldGroup>
                </DialogBody>
                {step.name === "start" && (
                    <DialogFooter>
                        <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        <MutationButton
                            type="button"
                            onClick={() => sendCurrentOtpMutation.mutate(session.user.email!)}
                            status={sendCurrentOtpMutation.status}
                            text={{
                                idle: "Send code",
                                pending: "Sending code...",
                                success: "Code sent!",
                            }}
                        />
                    </DialogFooter>
                )}
                {step.name === "verify-current" && (
                    <DialogFooter>
                        <Button variant="ghost" type="button" onClick={restart}>
                            Cancel
                        </Button>
                        <MutationButton
                            type="button"
                            onClick={changeEmailForm.handleSubmit((data) =>
                                requestEmailChangeMutation.mutate({
                                    newEmail: data.newEmail,
                                    otp: data.code,
                                }),
                            )}
                            status={requestEmailChangeMutation.status}
                            text={{ idle: "Verify", pending: "Verifying...", success: "Verified!" }}
                        />
                    </DialogFooter>
                )}
                {step.name === "verify-new" && (
                    <DialogFooter>
                        <Button variant="ghost" type="button" onClick={restart}>
                            Start over
                        </Button>
                        <MutationButton
                            type="button"
                            onClick={() =>
                                changeEmailMutation.mutate({
                                    newEmail: step.newEmail,
                                    otp: newCode,
                                })
                            }
                            status={changeEmailMutation.status}
                            text={{ idle: "Verify", pending: "Verifying...", success: "Verified!" }}
                        />
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
