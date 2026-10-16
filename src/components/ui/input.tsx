import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Opt-out attributes for the common password managers, which ignore `autoComplete="off"`
 * and treat any form with a name or email field as a login.
 */
const passwordManagerIgnoreProps = {
    autoComplete: "off",
    "data-1p-ignore": true,
    "data-lpignore": "true",
    "data-bwignore": true,
    "data-form-type": "other",
} as const;

function Input({
    className,
    type,
    ignorePasswordManagers = false,
    ...props
}: React.ComponentProps<"input"> & {
    /** Stop password managers offering to fill this input. Use on non-auth forms. */
    ignorePasswordManagers?: boolean;
}) {
    return (
        <input
            type={type}
            data-slot="input"
            {...(ignorePasswordManagers ? passwordManagerIgnoreProps : {})}
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
