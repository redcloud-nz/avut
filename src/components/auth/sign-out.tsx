/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSession } from "@/client/auth-queries";
import { useSignOut } from "@/client/use-sign-out";
import { RainbowSpinner } from "@/components/ui/loading";

export function SignOut() {
    const { data: session, isPending } = useSession();
    const signOut = useSignOut();
    const router = useRouter();

    // The session flips to null as part of signing out, which would otherwise re-enter this
    // effect and fire a second sign-out.
    const startedRef = useRef(false);

    useEffect(() => {
        if (isPending || startedRef.current) return;

        if (!session) {
            router.replace("/auth/sign-in");
            return;
        }

        startedRef.current = true;
        void signOut();
    }, [isPending, router, session, signOut]);

    return <RainbowSpinner />;
}
