/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { SiApple, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";

import { S2_Button } from "@/components/ui/s2-button";
import { Field } from "@/components/ui/field";

import { authClient } from "@/lib/auth-client";
import * as Paths from "@/paths";

export function Auth_SocialSignIn() {
    async function handleSignIn(provider: "apple" | "google" | "github") {
        try {
            const { data, error } = await authClient.signIn.social({
                provider,
                callbackURL: Paths.orgs.select.href,
            });

            if (error) {
                console.log("Social sign-in error", error);
                toast.error(`Social sign-in error: ${error.message}`);
            }
        } catch (error) {
            console.log("Social sign-in error", error);
            toast.error(
                "An error occured during social sign-in. Please try again.",
            );
        }
    }

    return (
        <Field className="grid grid-cols-3 gap-4">
            <S2_Button
                variant="outline"
                type="button"
                onClick={() => handleSignIn("apple")}
                disabled
            >
                <SiApple />
                <span className="sr-only">Sign in with Apple</span>
            </S2_Button>
            <S2_Button
                variant="outline"
                type="button"
                onClick={() => handleSignIn("google")}
                disabled
            >
                <SiGoogle />
                <span className="sr-only">Sign in with Google</span>
            </S2_Button>
            <S2_Button
                variant="outline"
                type="button"
                onClick={() => handleSignIn("github")}
                disabled
            >
                <SiGithub />
                <span className="sr-only">Sign in with GitHub</span>
            </S2_Button>
        </Field>
    );
}
