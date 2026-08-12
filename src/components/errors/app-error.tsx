/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useEffect } from "react";

import Artie from "@/components/art/artie";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

import { describeError, type ErrorDescription } from "./describe-error";

/** The full-height error panel. Rendered directly by the server-side `forbidden` boundary. */
export function AppErrorPanel({ title, description, pose }: ErrorDescription) {
    return (
        <div className="w-full h-screen flex flex-col justify-center md:items-center gap-4">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia>
                        <Artie pose={pose} />
                    </EmptyMedia>
                    <EmptyTitle>{title}</EmptyTitle>
                    <EmptyDescription>{description}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" asChild>
                        <Link href="/">Home Page</Link>
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    );
}

/** The panel driven by a caught error. Used by every `error.tsx` boundary. */
export function AppError({ error }: { error: Error }) {
    useEffect(() => {
        console.error("Error occurred:", error);
    }, [error]);

    return <AppErrorPanel {...describeError(error)} />;
}
