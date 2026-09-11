"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogScrollableBody,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Scratch page for PR #109 — dialog header reachability on small viewports.
 *
 * Open each dialog with the browser at a short viewport (e.g. 375×667, or shorter —
 * use the device toolbar and drag the height down to ~400px). Compare:
 *
 *  A. Wrapped body  — DialogHeader + close button stay pinned, only the body scrolls.
 *  B. Unwrapped body — no wrapper; relies on DialogContent's max-h-[calc(100dvh-2rem)]
 *     + overflow-y-auto fallback. The whole content (header included) scrolls, but the
 *     cap keeps the header from being pushed entirely off screen.
 *  C. Unwrapped, NO cap — reproduces the original bug: header/close pushed off screen
 *     with no way to dismiss (className overrides the max-h). For contrast only.
 *  D. AlertDialog — same max-h fallback, no scrollable-body wrapper exists for it.
 */

function Filler({ lines = 40 }: { lines?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: lines }, (_, i) => (
                <p key={i} className="text-sm">
                    {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                    tempor incididunt ut labore et dolore magna aliqua.
                </p>
            ))}
        </div>
    );
}

export default function DialogSmallViewportScratchPage() {
    const [lines, setLines] = React.useState(6);
    return (
        <div className="mx-auto max-w-2xl space-y-6 p-8">
            <div className="space-y-1">
                <h1 className="font-heading text-xl font-medium">
                    Dialog · small viewport behaviour (PR #109)
                </h1>
                <p className="text-sm text-muted-foreground">
                    Resize the viewport short (device toolbar → drag height to ~400–500px), then
                    open each dialog and try to reach the close button / header.
                </p>
                <label className="flex items-center gap-2 pt-2 text-sm">
                    Body lines: {lines}
                    <input
                        type="range"
                        min={1}
                        max={60}
                        value={lines}
                        onChange={(e) => setLines(Number(e.target.value))}
                    />
                    <span className="text-muted-foreground">
                        (drop low enough that the content fits without scrolling)
                    </span>
                </label>
            </div>

            <div className="flex flex-wrap gap-3">
                {/* A — wrapped body */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button>A · Wrapped body (pinned header)</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>A · DialogScrollableBody</DialogTitle>
                            <DialogDescription>
                                Header + close button stay pinned; only this body scrolls.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogScrollableBody>
                            <Filler lines={lines} />
                        </DialogScrollableBody>
                        <DialogFooter showCloseButton />
                    </DialogContent>
                </Dialog>

                {/* B — unwrapped, default cap */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="secondary">B · Unwrapped (default cap)</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>B · No wrapper, default max-h</DialogTitle>
                            <DialogDescription>
                                Whole content scrolls (header too), but the max-h fallback keeps the
                                header from being pushed fully off screen.
                            </DialogDescription>
                        </DialogHeader>
                        <Filler lines={lines} />
                        <DialogFooter showCloseButton />
                    </DialogContent>
                </Dialog>

                {/* C — unwrapped, cap defeated (original bug) */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="destructive">C · No cap (original bug)</Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-none overflow-visible">
                        <DialogHeader>
                            <DialogTitle>C · max-h-none — reproduces the bug</DialogTitle>
                            <DialogDescription>
                                On a short viewport the header + close button get pushed off the top
                                with no way to dismiss.
                            </DialogDescription>
                        </DialogHeader>
                        <Filler lines={lines} />
                        <DialogFooter showCloseButton />
                    </DialogContent>
                </Dialog>

                {/* D — AlertDialog */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">D · AlertDialog (default cap)</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>D · AlertDialogContent max-h</AlertDialogTitle>
                            <AlertDialogDescription>
                                Same calc(100dvh-2rem) cap; no scrollable-body wrapper.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Filler lines={lines} />
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
