/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export interface AVUTLogger {
    log(message: string, ...data: unknown[]): void;
    info(message: string, ...data: unknown[]): void;
    debug(message: string, ...data: unknown[]): void;
    error(message: string, ...optionalParams: unknown[]): void;
    warn(message: string, ...optionalParams: unknown[]): void;
}

export const AVUTLogger = {
    getConsoleLogger(name: string): AVUTLogger {
        return new AVUTConsoleLogger(name);
    },
} as const;

export class AVUTConsoleLogger implements AVUTLogger {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    log(message: string, ...data: unknown[]) {
        console.log(`[${this.name}] ${message}`, ...data);
    }
    info(message: string, ...data: unknown[]) {
        console.info(`[${this.name}] ${message}`, ...data);
    }

    debug(message: string, ...data: unknown[]) {
        console.debug(`[${this.name}] ${message}`, ...data);
    }

    error(message: string, ...optionalParams: unknown[]) {
        console.error(`[${this.name}] ${message}`, ...optionalParams);
    }

    warn(message: string, ...optionalParams: unknown[]) {
        console.warn(`[${this.name}] ${message}`, ...optionalParams);
    }
}
