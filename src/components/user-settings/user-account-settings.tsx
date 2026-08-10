/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Alert } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RainbowSpinner } from "@/components/ui/loading";

import { getUserInitials } from "@/lib/utils";
import { type AuthSession } from "@/server/auth";

export function UserAccountSettings() {
    const sessionQuery = authClient.useSession();
    // const [isMounted, setIsMounted] = useState(true);

    // useEffect(() => {
    //     setIsMounted(true);
    // }, []);

    // if (!isMounted) return <div className="h-10 w-10" />;

    if (sessionQuery.isPending) {
        return <RainbowSpinner className="mx-auto" />;
    }

    if (!sessionQuery.data) {
        return <Alert variant="error">No user data available</Alert>;
    }

    return (
        <div className="space-y-4">
            <UserProfile_Card session={sessionQuery.data} />
            <UserEmail_Card session={sessionQuery.data} refetchSession={sessionQuery.refetch} />
        </div>
    );
}

function UserProfile_Card({ session }: { session: AuthSession }) {
    const form = useForm({
        resolver: zodResolver(z.object({ name: z.string().min(1).max(100) })),
        defaultValues: {
            name: session.user.name || "",
        },
    });

    const mutation = useMutation({
        async mutationFn(formData: { name: string }) {
            await authClient.updateUser({ name: formData.name });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    id="update-profile-form"
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                >
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Avatar</FieldLabel>
                            <div className="min-w-1/2">
                                <Avatar className="size-12 rounded-full">
                                    {session.user.image && (
                                        <AvatarImage src={session.user.image} alt="User Avatar" />
                                    )}
                                    <AvatarFallback className="rounded-full">
                                        {getUserInitials(session.user.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </Field>
                        <Controller
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                                    <Input
                                        id={field.name}
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => form.reset()}>
                    Cancel
                </Button>
                <MutationButton
                    form="update-profile-form"
                    status={mutation.status}
                    text={{
                        idle: "Save",
                        pending: "Saving...",
                        success: "Saved!",
                    }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}

type ChangeEmailStep =
    | { name: "start" }
    | { name: "verify-current" }
    | { name: "verify-new"; newEmail: string };

function UserEmail_Card({
    session,
    refetchSession,
}: {
    session: AuthSession;
    refetchSession: () => Promise<void>;
}) {
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
        async mutationFn() {
            await authClient.emailOtp.sendVerificationOtp(
                { email: session.user.email!, type: "email-verification" },
                { throw: true },
            );
        },
        onSuccess() {
            setStep({ name: "verify-current" });
        },
    });

    const requestEmailChangeMutation = useMutation({
        async mutationFn({ newEmail, otp }: { newEmail: string; otp: string }) {
            await authClient.emailOtp.requestEmailChange({ newEmail, otp }, { throw: true });
            return newEmail;
        },
        onSuccess(newEmail) {
            // Don't reset changeEmailForm here - the code/new-email fields stay visible
            // (disabled) as a record of what was already confirmed.
            setStep({ name: "verify-new", newEmail });
        },
    });

    const changeEmailMutation = useMutation({
        async mutationFn({ newEmail, otp }: { newEmail: string; otp: string }) {
            await authClient.emailOtp.changeEmail({ newEmail, otp }, { throw: true });
            return newEmail;
        },
        async onSuccess() {
            // /email-otp/change-email isn't in the client's atomListeners, so the shared
            // session store won't auto-refresh on its own - explicitly refetch it so this
            // card (and the rest of the UI, e.g. nav) picks up the new email immediately.
            await refetchSession();
            toast.success("Your email address has been updated.");
            restart();
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
        authClient.emailOtp.sendVerificationOtp({
            email: session.user.email!,
            type: "email-verification",
        });
        toast("Verification code resent to your current email.");
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Change Email</CardTitle>
                <CardDescription>
                    Update the email address associated with your account.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Field orientation="responsive">
                        <FieldContent>
                            <FieldLabel>Current Email</FieldLabel>
                            {step.name === "start" && (
                                <FieldDescription>
                                    We&apos;ll send a verification code to this address to confirm
                                    it&apos;s you.
                                </FieldDescription>
                            )}
                        </FieldContent>
                        <FieldContent>
                            <Input
                                disabled
                                type="email"
                                className="min-w-1/2"
                                value={session.user.email}
                            />
                        </FieldContent>
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
                                        <FieldContent>
                                            <FieldLabel htmlFor="current-email-code">
                                                Verification Code
                                            </FieldLabel>
                                            {step.name === "verify-current" && (
                                                <FieldDescription>
                                                    Enter the 6-digit code we sent to your current
                                                    email ({session.user.email}).
                                                    <br />
                                                    Didn&apos;t receive it?{" "}
                                                    <a onClick={resendCurrentOtp}>Resend</a>
                                                </FieldDescription>
                                            )}
                                        </FieldContent>
                                        <FieldContent>
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
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </FieldContent>
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
                                        <FieldContent>
                                            <FieldLabel htmlFor="user-new-email">
                                                New Email
                                            </FieldLabel>
                                        </FieldContent>
                                        <FieldContent>
                                            <Input
                                                id="user-new-email"
                                                type="email"
                                                aria-invalid={fieldState.invalid}
                                                className="min-w-1/2"
                                                disabled={
                                                    step.name === "verify-new" ||
                                                    requestEmailChangeMutation.isPending
                                                }
                                                {...field}
                                            />
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </FieldContent>
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
                                <FieldContent>
                                    <FieldLabel>Verification Code</FieldLabel>
                                    <FieldDescription>
                                        Enter the 6-digit code we sent to your new email address (
                                        {step.newEmail}).
                                    </FieldDescription>
                                </FieldContent>
                                <FieldContent>
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
                                </FieldContent>
                            </Field>
                            {changeEmailMutation.isError && (
                                <FieldError
                                    errors={[changeEmailMutation.error as { message?: string }]}
                                />
                            )}
                        </>
                    )}
                </FieldGroup>
            </CardContent>
            {step.name === "start" && (
                <CardFooter className="flex justify-end">
                    <MutationButton
                        type="button"
                        onClick={() => sendCurrentOtpMutation.mutate()}
                        status={sendCurrentOtpMutation.status}
                        text={{
                            idle: "Send code",
                            pending: "Sending code...",
                            success: "Code sent!",
                        }}
                    />
                </CardFooter>
            )}
            {step.name === "verify-current" && (
                <CardFooter className="flex justify-end gap-2">
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
                        text={{
                            idle: "Verify",
                            pending: "Verifying...",
                            success: "Verified!",
                        }}
                    />
                </CardFooter>
            )}
            {step.name === "verify-new" && (
                <CardFooter className="flex justify-end gap-2">
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
                        text={{
                            idle: "Verify",
                            pending: "Verifying...",
                            success: "Verified!",
                        }}
                    />
                </CardFooter>
            )}
        </Card>
    );
}
