/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

class AVUTLogger {
    private component: string;

    constructor(component: string) {
        this.component = component;
    }

    log(message: string, ...data: any[]) {
        console.log(`[${this.component}] ${message}`, ...data);
    }

    error(message: string, ...optionalParams: any[]) {
        console.error(`[${this.component}] ${message}`, ...optionalParams);
    }

    warn(message: string, ...optionalParams: any[]) {
        console.warn(`[${this.component}] ${message}`, ...optionalParams);
    }
}

export function useLogger(module: string, component: string): AVUTLogger {
    return new AVUTLogger(`${module}/${component}`);
}
