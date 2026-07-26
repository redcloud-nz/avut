/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const Tmpl = {
    validate(tmpl: string, keys: string[]): boolean {
        const data: Record<string, any> = {};
        for (const key of keys) {
            data[key] = "test";
        }

        const result = this.renderSafe(tmpl, data);
        return result.error === undefined;
    },

    render(tmpl: string, data: Record<string, any>): string {
        const result = tmpl.replace(/{{\s*([^}\s]+)\s*}}/g, (_, key) => {
            if (key in data) {
                return String(data[key]);
            } else {
                throw new Error(`Missing value for placeholder: ${key}`);
            }
        });
        return result;
    },

    renderSafe(
        tmpl: string,
        data: Record<string, any>,
    ): { data: string; error: undefined } | { data: undefined; error: string } {
        try {
            const result = this.render(tmpl, data);
            return { data: result, error: undefined };
        } catch (error) {
            return { data: undefined, error: (error as Error).message };
        }
    },
} as const;
