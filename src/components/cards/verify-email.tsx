/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
 * @param redirect - Optional redirect URL after verification.
 */
export function VerifyEmail_Card({
    email,
    redirect,
}: {
    email: string;
    redirect?: string;
}) {
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
                if (redirect) router.push(redirect);
                else router.push(Paths.orgs.select.href);
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
        <Card>
            <CardHeader>
                <CardTitle>Enter verification code</CardTitle>
                <CardDescription>
                    We sent a 6-digit code to your email.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                        <Button
                            type="submit"
                            onClick={handleVerify}
                            disabled={
                                code.length < 6 || state.status === "InProgress"
                            }
                        >
                            {state.status === "InProgress"
                                ? "Verifying..."
                                : "Verify"}
                        </Button>
                    </Field>
                    {state.status === "Error" && (
                        <FieldError errors={[state.error]} />
                    )}
                    <FieldDescription className="text-center">
                        Didn't receive the code?{" "}
                        <a onClick={handleResend}>Resend</a>
                    </FieldDescription>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
