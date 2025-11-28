/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { CheckIcon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

export type StepperProps = Omit<
    React.ComponentPropsWithRef<"nav">,
    "children"
> & {
    activeStep: number;
    steps: { name: string }[];
};

export function Stepper({ activeStep, steps, ...props }: StepperProps) {
    return (
        <nav {...props}>
            <ol
                role="list"
                className="divide-y divide-gray-300 rounded-md border border-gray-300 md:flex md:divide-y-0"
            >
                {steps.map((step, index) => (
                    <Step
                        key={index}
                        name={step.name}
                        stepIndex={index}
                        status={
                            activeStep > index
                                ? "Complete"
                                : activeStep == index
                                  ? "Current"
                                  : null
                        }
                        isLast={index == steps.length - 1}
                    />
                ))}
            </ol>
        </nav>
    );
}

type StepProps = React.ComponentPropsWithRef<"li"> & {
    name: string;
    status: "Complete" | "Current" | null;
    stepIndex: number;
    isLast: boolean;
};

function Step({ name, stepIndex, status, isLast }: StepProps) {
    return (
        <li className="relative md:flex md:flex-1" aria-label="Progress">
            {status == "Complete" ? (
                <a className={cn("group flex w-full items-center")}>
                    <span className="flex items-center px-6 py-4 text-sm font-medium">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 group-hover:bg-indigo-800">
                            <CheckIcon
                                aria-hidden="true"
                                className="size-6 text-white"
                            />
                        </span>
                        <span className="ml-4 text-sm font-medium text-gray-900 select-none">
                            {name}
                        </span>
                    </span>
                </a>
            ) : status == "Current" ? (
                <a
                    className={cn(
                        "flex items-center px-6 py-4 text-sm font-medium",
                    )}
                    aria-current="step"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-indigo-600">
                        <span className="text-indigo-600 select-none">
                            {stepIndex + 1}
                        </span>
                    </span>
                    <span className="ml-4 text-sm font-medium text-indigo-600 select-none">
                        {name}
                    </span>
                </a>
            ) : (
                <a className={cn("group flex items-center")}>
                    <span className="flex items-center px-6 py-4 text-sm font-medium">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 group-hover:border-gray-400">
                            <span className="text-gray-500 group-hover:text-gray-900 select-none">
                                {stepIndex + 1}
                            </span>
                        </span>
                        <span className="ml-4 text-sm font-medium text-gray-500 group-hover:text-gray-900 select-none">
                            {name}
                        </span>
                    </span>
                </a>
            )}
            {!isLast ? (
                <>
                    <div
                        aria-hidden="true"
                        className="absolute right-0 top-0 hidden h-full w-5 md:block"
                    >
                        <svg
                            fill="none"
                            viewBox="0 0 22 80"
                            preserveAspectRatio="none"
                            className="size-full text-gray-300"
                        >
                            <path
                                d="M 0 -2 L 20 40 L 0 82"
                                stroke="currentcolor"
                                vectorEffect="non-scaling-stroke"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                </>
            ) : null}
        </li>
    );
}
