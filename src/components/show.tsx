/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

interface SimpleShowProps {
    children: ReactNode;
    fallback?: ReactNode;
    when: boolean;
}

interface MultiConditionShowProps {
    children: ReactNode;
    conditions: { condition: boolean; fallback?: ReactNode }[];
}

type ShowProps = SimpleShowProps | MultiConditionShowProps;

export function Show(props: ShowProps) {
    if ("when" in props) {
        return props.when ? props.children : props.fallback;
    } else {
        for (const condition of props.conditions) {
            if (!condition.condition) {
                return condition.fallback ?? null;
            }
        }
        return props.children;
    }
}
