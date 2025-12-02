/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { S2_Button } from "@/components/ui/s2-button";
import {
    S2_Card,
    S2_CardContent,
    S2_CardDescription,
    S2_CardHeader,
    S2_CardTitle,
} from "@/components/ui/s2-card";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

/**
 * Card for verifying user's email with OTP code.
 * @param email - The email address to verify.
 */
export function VerifyEmail_Card({ email }: { email: string }) {
    const router = useRouter();

    const [inProgress, setInProgress] = useState(false);
    const [code, setCode] = useState<string>("");
    const [verifyError, setVerifyError] = useState<{ message?: string } | null>(
        null,
    );

    async function handleVerify() {
        try {
            setInProgress(true);
            const { data, error } = await authClient.emailOtp.verifyEmail({
                email: email,
                otp: code,
            });
            if (error) {
                setVerifyError(error);
                console.log("Email verification error", error);
            } else {
                console.log("Email verified successfully", data);
                router.push(Paths.orgs.select.href);
            }
        } catch (error) {
            console.log("Email verification error", error);
            toast.error(
                "An error occured during email verification. Please try again.",
            );
        } finally {
            setInProgress(false);
        }
    }

    function handleResend() {
        authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
        });
        toast("Verification code resent to your email.");
    }

    return (
        <S2_Card>
            <S2_CardHeader>
                <S2_CardTitle>Enter verification code</S2_CardTitle>
                <S2_CardDescription>
                    We sent a 6-digit code to your email.
                </S2_CardDescription>
            </S2_CardHeader>
            <S2_CardContent>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Verification Code</FieldLabel>
                        <InputOTP
                            maxLength={6}
                            value={code}
                            onChange={setCode}
                            pattern={REGEXP_ONLY_DIGITS}
                            disabled={inProgress}
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
                        <S2_Button
                            type="submit"
                            onClick={handleVerify}
                            disabled={code.length < 6 || inProgress}
                        >
                            {inProgress ? "Verifying..." : "Verify"}
                        </S2_Button>
                    </Field>
                    {verifyError && <FieldError errors={[verifyError]} />}
                    <FieldDescription className="text-center">
                        Didn't receive the code?{" "}
                        <a onClick={handleResend}>Resend</a>
                    </FieldDescription>
                </FieldGroup>
            </S2_CardContent>
        </S2_Card>
    );
}
