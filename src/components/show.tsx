/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

export interface ShowProps {
    children: ReactNode;
    fallback?: ReactNode;
    when: boolean;
}

export function Show({ children, fallback, when }: ShowProps) {
    if (when) return children;
    else return fallback;
}
