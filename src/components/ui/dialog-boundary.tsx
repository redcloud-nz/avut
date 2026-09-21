/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Alert } from "./alert";
import { DialogBody, DialogCloseButton, DialogFooter } from "./dialog";
import { Spinner } from "./spinner";

export interface DialogBoundaryProps {
    /** The dialog's data-dependent body and footer — suspends (e.g. `useSuspenseQuery`) while loading. */
    children: ReactNode;
    /**
     * Header shown while loading and when loading fails. Only needed when the header the children
     * render depends on the data they fetch; a header that depends on props belongs above the
     * boundary instead. Must contain a `DialogTitle`.
     */
    fallbackHeader?: ReactNode;
}

/**
 * Loading and error handling for the part of a dialog that waits on data: put it between
 * `DialogHeader` and the body/footer, inside `DialogContent`.
 *
 * ```tsx
 * <DialogContent>
 *     <DialogHeader>…</DialogHeader>
 *     <DialogBoundary>
 *         <Inner />    // returns <DialogBody> + <DialogFooter>
 *     </DialogBoundary>
 * </DialogContent>
 * ```
 *
 * While loading it shows a spinner where the body will be (no footer); if the children throw it
 * shows the error with a Close button. Neither state touches the header, so the dialog keeps its
 * title (the close button and Escape are `DialogContent`'s, so they work throughout).
 */
export function DialogBoundary({ children, fallbackHeader }: DialogBoundaryProps) {
    return (
        <ErrorBoundary
            onError={(error) => console.error("Dialog failed to load:", error)}
            fallbackRender={({ error }) => (
                <>
                    {fallbackHeader}
                    <DialogBody>
                        <Alert variant="error">
                            {error instanceof Error ? error.message : "Something went wrong."}
                        </Alert>
                    </DialogBody>
                    <DialogFooter>
                        <DialogCloseButton variant="outline">Close</DialogCloseButton>
                    </DialogFooter>
                </>
            )}
        >
            <Suspense
                fallback={
                    <>
                        {fallbackHeader}
                        {/* The min-height only matters on desktop, where the dialog would otherwise
                            jump in size when the data arrives; full screen already fills the height. */}
                        <DialogBody
                            aria-busy="true"
                            className="items-center justify-center sm:min-h-40"
                        >
                            <Spinner className="size-6 text-muted-foreground" />
                        </DialogBody>
                    </>
                }
            >
                {children}
            </Suspense>
        </ErrorBoundary>
    );
}
