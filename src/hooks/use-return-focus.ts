/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRef, type RefObject } from "react";

/**
 * Focus handlers for a controlled Radix dialog with no `DialogTrigger` (one opened from a URL param,
 * say). Radix returns focus on close to the dialog's own trigger, so without one focus falls to
 * `<body>`. Spread the result onto `DialogContent`.
 *
 * On close, focus goes back to whatever was focused when the dialog opened, as long as that
 * element is still in the document. When it isn't (an item in a sheet or menu that has since
 * closed), focus goes to `fallbackRef`.
 */
export function useReturnFocus(fallbackRef?: RefObject<HTMLElement | null>) {
    const openerRef = useRef<Element | null>(null);

    return {
        onOpenAutoFocus: () => {
            // Radix fires this before moving focus into the dialog, so this is the opener.
            openerRef.current = document.activeElement;
        },
        onCloseAutoFocus: (event: Event) => {
            const opener = openerRef.current;
            openerRef.current = null;
            const target =
                opener instanceof HTMLElement && opener !== document.body && opener.isConnected
                    ? opener
                    : fallbackRef?.current;
            if (!target) return;
            event.preventDefault();
            target.focus();
        },
    };
}
