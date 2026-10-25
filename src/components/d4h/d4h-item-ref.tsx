/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * A D4H equipment item's ref, with AVUT's `#` prefix set apart (muted, monospace) from the ref
 * itself. D4H refs are free text and some already start with `#`, so the prefix has to read as
 * ours rather than as part of the ref.
 */
export function D4HItemRef({ value }: { value: string }) {
    return (
        <>
            <span className="font-mono text-muted-foreground">#</span>
            {value}
        </>
    );
}
