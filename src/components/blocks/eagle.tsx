/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Eagle page design components.
 *
 * A section for comparing JSON snippet from input and parsed JSON.
 */

import { ComponentProps } from "react";
import { cn } from "tailwind-variants";
import { ZodSafeParseResult } from "zod";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert2";

function EagleSection({ className, ...props }: ComponentProps<"section">) {
    return <section className={cn("border-b py-2", className)} {...props} />;
}

function EagleTitle({ className, ...props }: ComponentProps<"h4">) {
    return (
        <h4
            className={cn(
                "col-span-full text-md font-semibold tracking-tight text-center",
                className,
            )}
            {...props}
        />
    );
}

type EagleContentProps = Omit<ComponentProps<"div">, "children"> & {
    raw: any;
    parsed: ZodSafeParseResult<any>;
};

function EagleContent({ className, raw, parsed, ...props }: EagleContentProps) {
    return (
        <div className={cn("grid grid-cols-2 gap-4", className)} {...props}>
            <div
                data-role="raw-json"
                className="px-2 max-h-[50vh] overflow-y-auto"
            >
                <pre className="text-xs">{JSON.stringify(raw, null, 2)}</pre>
            </div>
            <div
                data-role="parsed-json"
                className="px-2 max-h-[50vh] overflow-y-auto"
            >
                {parsed.success ? (
                    <pre className="text-xs">
                        {JSON.stringify(parsed.data, null, 2)}
                    </pre>
                ) : (
                    <Alert>
                        <AlertTitle>Failed to validate</AlertTitle>
                        <AlertDescription>
                            {parsed.error.message}
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}

export const Eagle = {
    Section: EagleSection,
    Title: EagleTitle,
    Content: EagleContent,
};
