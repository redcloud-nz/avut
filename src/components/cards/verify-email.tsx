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
import { InputOTP } from "@/components/ui/input-otp";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

/**
 * Card for verifying user's email with OTP code.
 * @param email - The email address to verify.
 */
export function VerifyEmail_Card({ email }: { email: string }) {
    const router = useRouter();

    const [code, setCode] = useState<string>("");

    const [state, setState] = useState<
        | { status: "Ready" | "InProgress" }
        | { status: "Error"; error: { message?: string } }
    >({ status: "Ready" });

    async function handleVerify() {
        try {
            setState({ status: "InProgress" });
            const { data, error } = await authClient.emailOtp.verifyEmail({
                email: email,
                otp: code,
            });
            if (error) {
                setState({ status: "Error", error });
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
            setState({ status: "Ready" });
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
                        <InputOTP.Root
                            maxLength={6}
                            value={code}
                            onChange={setCode}
                            pattern={REGEXP_ONLY_DIGITS}
                            disabled={state.status === "InProgress"}
                        >
                            <InputOTP.Group className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                                <InputOTP.Slot index={0} />
                                <InputOTP.Slot index={1} />
                                <InputOTP.Slot index={2} />
                                <InputOTP.Slot index={3} />
                                <InputOTP.Slot index={4} />
                                <InputOTP.Slot index={5} />
                            </InputOTP.Group>
                        </InputOTP.Root>
                        <FieldDescription>
                            Enter the 6-digit code sent to your email.
                        </FieldDescription>
                    </Field>
                    <Field>
                        <S2_Button
                            type="submit"
                            onClick={handleVerify}
                            disabled={
                                code.length < 6 || state.status === "InProgress"
                            }
                        >
                            {state.status === "InProgress"
                                ? "Verifying..."
                                : "Verify"}
                        </S2_Button>
                    </Field>
                    {state.status === "Error" && (
                        <FieldError errors={[state.error]} />
                    )}
                    <FieldDescription className="text-center">
                        Didn't receive the code?{" "}
                        <a onClick={handleResend}>Resend</a>
                    </FieldDescription>
                </FieldGroup>
            </S2_CardContent>
        </S2_Card>
    );
}
