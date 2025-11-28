/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { HardHatIcon } from "lucide-react";
import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export interface UnderConstructionProps extends ComponentProps<"div"> {
    /**
     * Message to display in the overlay
     * @default "Under Construction"
     */
    message?: string;
    /**
     * Show icon in the overlay
     * @default true
     */
    showIcon?: boolean;
}

/**
 * UnderConstruction component that renders an overlay with construction barrier tape
 * over a particular card or other item.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Card>
 *     <CardHeader>...</CardHeader>
 *     <CardContent>...</CardContent>
 *   </Card>
 *   <UnderConstruction />
 * </div>
 * ```
 */
export function UnderConstruction({
    message = "Coming Soon",
    showIcon = true,
    className,
    ...props
}: UnderConstructionProps) {
    return (
        <div
            className={cn(
                "absolute inset-0 z-50 flex flex-col items-center justify-center",
                "bg-background/25 backdrop-blur-sm rounded-sm",
                "radius-[inherit] overflow-clip",
                className,
            )}
            {...props}
        >
            {/* Top barrier tape */}
            <div className="absolute top-[50%] left-[-50%] right-[-50%] h-10 overflow-hidden shadown-md origin-center rotate-30">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 opacity-95">
                    <div className="absolute inset-0 bg-repeating-stripe" />
                </div>
                {/* <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black tracking-[0.5em] opacity-80">
                    CAUTION
                </div> */}
            </div>

            {/* Bottom barrier tape */}
            <div className="absolute top-[50%] left-[-50%] right-[-50%] h-10 overflow-hidden origin-center rotate-[-30deg]">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 opacity-90">
                    <div className="absolute inset-0 bg-repeating-stripe" />
                </div>
                {/* <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black tracking-[0.5em] opacity-80">
                    CAUTION
                </div> */}
            </div>

            {/* Center content */}
            <div className="flex flex-col items-center px-4 py-2 text-center bg-card border radius-md shadow-md z-10">
                {showIcon && (
                    <div className="relative">
                        <HardHatIcon
                            className="w-16 h-16 text-yellow-500"
                            strokeWidth={1.5}
                        />
                    </div>
                )}
                <div className="text-lg font-semibold text-foreground">
                    {message}
                </div>
            </div>

            {/* CSS for striped pattern */}
            <style jsx>{`
                .bg-repeating-stripe {
                    background: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 30px,
                        rgba(0, 0, 0, 1) 30px,
                        rgba(0, 0, 0, 1) 60px
                    );
                }
            `}</style>
        </div>
    );
}
