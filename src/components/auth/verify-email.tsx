/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { postSignInUrl } from "@/lib/auth-redirect";

/**
 * Card for verifying user's email with OTP code.
 * @param email - The email address to verify.
 * @param redirectTo - Optional path to return to once verified and signed in.
 */
export function VerifyEmail_Card({ email, redirectTo }: { email: string; redirectTo?: string }) {
    const router = useRouter();

    const [code, setCode] = useState<string>("");

    const mutation = useMutation({
        async mutationFn(otp: string) {
            const { data, error } = await authClient.emailOtp.verifyEmail({ email, otp });
            if (error) {
                throw new Error(error.message ?? "Unable to verify email.");
            }
            return data;
        },
        onSuccess() {
            router.push(postSignInUrl(redirectTo));
        },
    });

    function handleResend() {
        authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
        });
        toast("Verification code resent to your email.");
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Enter verification code</CardTitle>
                <CardDescription>We sent a 6-digit code to your email.</CardDescription>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Verification Code</FieldLabel>
                        <InputOTP
                            maxLength={6}
                            value={code}
                            onChange={setCode}
                            pattern={REGEXP_ONLY_DIGITS}
                            disabled={mutation.isPending}
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
                            Enter the 6-digit code sent to your email.
                        </FieldDescription>
                    </Field>
                    <Field>
                        <MutationButton
                            type="button"
                            onClick={() => mutation.mutate(code)}
                            disabled={code.length < 6}
                            status={mutation.status}
                            text={{ idle: "Verify", pending: "Verifying...", success: "Verified!" }}
                        />
                    </Field>
                    {mutation.isError && <FieldError errors={[mutation.error]} />}
                    <FieldDescription className="text-center">
                        Didn&apos;t receive the code?{" "}
                        <button
                            type="button"
                            className="cursor-pointer underline-offset-4 hover:underline"
                            onClick={handleResend}
                        >
                            Resend
                        </button>
                    </FieldDescription>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
