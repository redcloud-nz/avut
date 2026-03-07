/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

export class Logger {
    private component: string;

    constructor(component: string) {
        this.component = component;
    }

    log(message: string) {
        console.log(`[${this.component}] ${message}`);
    }

    error(message: string, error?: Error) {
        if (error) console.error(`[${this.component}] ${message}`, error);
        else console.error(`[${this.component}] ${message}`);
    }

    warn(message: string) {
        console.warn(`[${this.component}] ${message}`);
    }
}
