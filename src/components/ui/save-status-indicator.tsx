/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { match } from "ts-pattern";

import { useMutation } from "@tanstack/react-query";
import { Spinner } from "./spinner";

export function SaveStatusIndicator({
    status,
}: {
    status: ReturnType<typeof useMutation>["status"];
}) {
    return (
        <div className="relative w-12 h-4 text-xs">
            {match(status)
                .with("idle", () => null)
                .with("pending", () => (
                    <>
                        <div className="font-semibold text-center">Saving</div>
                        <Spinner className="absolute size-8 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 opacity-25" />
                    </>
                ))
                .with("success", () => (
                    <>
                        <div className="font-semibold text-center">Saved</div>
                    </>
                ))
                .with("error", () => (
                    <>
                        <div className="font-semibold text-center">Error</div>
                    </>
                ))
                .exhaustive()}
        </div>
    );
}
