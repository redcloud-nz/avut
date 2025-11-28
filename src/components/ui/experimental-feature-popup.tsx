/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { FlaskConicalIcon } from "lucide-react";
import { ComponentProps } from "react";

import {
    Popover,
    PopoverContent,
    PopoverTriggerButton,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ExperimentalFeaturePopup({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <Popover>
            <PopoverTriggerButton
                variant="ghost"
                size="icon"
                tooltip="Experimental Feature"
                className="text-pink-400"
            >
                <FlaskConicalIcon />
            </PopoverTriggerButton>
            <PopoverContent align="end" className="w-96">
                <div
                    className={cn(
                        "text-sm text-muted-foreground space-y-2",
                        className,
                    )}
                    {...props}
                />
            </PopoverContent>
        </Popover>
    );
}
