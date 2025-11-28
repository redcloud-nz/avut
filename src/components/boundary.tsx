/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Alert } from "./ui/alert";
import { LoadingFallback } from "./ui/loading";

export interface BoundaryProps {
    children: ReactNode;
    slotProps?: {
        errorAlert?: ComponentProps<typeof Alert>;
        loadingFallback?: ComponentProps<typeof LoadingFallback>;
    };
}

export function Boundary({ children, slotProps = {} }: BoundaryProps) {
    return (
        <ErrorBoundary
            fallbackRender={({ error }) => {
                const alertProps = {
                    severity: "error" as const,
                    title: "An error occured",
                    ...(slotProps.errorAlert ?? {}),
                };
                return <Alert {...alertProps}>{error.message}</Alert>;
            }}
        >
            <Suspense
                fallback={
                    <LoadingFallback {...(slotProps.loadingFallback ?? {})} />
                }
            >
                {children}
            </Suspense>
        </ErrorBoundary>
    );
}
