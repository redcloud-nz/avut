/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/client/auth-client";
import { RainbowSpinner } from "@/components/ui/loading";

export function SignOut() {
    const { data: session } = authClient.useSession();
    const router = useRouter();

    useEffect(() => {
        if (!session) {
            router.push("/auth/sign-in");
            return;
        }

        authClient.signOut().then(() => {
            router.push("/auth/sign-in");
        });
    }, []);

    return <RainbowSpinner />;
}
