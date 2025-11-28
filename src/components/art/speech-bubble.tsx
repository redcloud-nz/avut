/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { tv } from "tailwind-variants";

// Color constants for speech bubble styling
const COLORS = {
    background: "transparent", // Transparent background
    fill: "#FFFFFF", // White fill for the bubble
    borderDark: "#3D0E13", // Very dark burgundy/red - outer border
    borderMid: "#E63A1A", // Dark red - middle layer
    borderLight: "#A52C3A", // Medium red - accent
    textOutline: "#2A0A0E", // Very dark red/black - text outline
    textFill: "#6B1E28", // Dark red - text fill
} as const;

interface SpeechBubbleProps {
    text: string;
    direction?: "left" | "right";
    position?: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
    };
    className?: string;
}

/**
 * SVG-based speech bubble component similar to comic book style.
 */
export function SpeechBubble1({
    text,
    direction = "left",
    position,
    className = "",
}: SpeechBubbleProps) {
    // Calculate dimensions based on text length with better precision
    // Approximate character width for Arial Black at size 32
    const charWidth = 20;
    const padding = 40;
    const estimatedWidth = Math.max(180, text.length * charWidth + padding * 2);
    const estimatedHeight = 85;

    // Tail path based on direction
    const tailPath =
        direction === "left"
            ? `M 30,${estimatedHeight - 10} L 10,${estimatedHeight + 20} L 50,${estimatedHeight - 5}`
            : `M ${estimatedWidth - 30},${estimatedHeight - 10} L ${estimatedWidth + 10},${estimatedHeight + 20} L ${estimatedWidth - 50},${estimatedHeight - 5}`;

    // Position styling
    const positionStyle = position
        ? {
              position: "absolute" as const,
              ...position,
          }
        : {};

    return (
        <div style={positionStyle} className={`inline-block ${className}`}>
            <svg
                width={estimatedWidth}
                height={estimatedHeight + 30}
                viewBox={`0 0 ${estimatedWidth} ${estimatedHeight + 30}`}
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-md"
            >
                {/* Main bubble with thick border */}
                <rect
                    x="8"
                    y="8"
                    width={estimatedWidth - 16}
                    height={estimatedHeight - 16}
                    rx="18"
                    ry="18"
                    fill={COLORS.fill}
                    stroke={COLORS.borderDark}
                    strokeWidth="7"
                />

                {/* Inner accent border */}
                <rect
                    x="11"
                    y="11"
                    width={estimatedWidth - 22}
                    height={estimatedHeight - 22}
                    rx="15"
                    ry="15"
                    fill="none"
                    stroke={COLORS.borderLight}
                    strokeWidth="1.5"
                    opacity="0.5"
                />

                {/* Speech bubble tail - main */}
                <path
                    d={tailPath}
                    fill={COLORS.fill}
                    stroke={COLORS.borderDark}
                    strokeWidth="7"
                    strokeLinejoin="round"
                />

                {/* Text with two-color effect */}
                {/* Text outline in very dark color for definition */}
                <text
                    x={estimatedWidth / 2}
                    y={estimatedHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="none"
                    stroke={COLORS.textOutline}
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                    fontFamily="Arial Black, Arial, sans-serif"
                    fontSize="30"
                    fontWeight="900"
                    letterSpacing="1.5"
                    style={{ textTransform: "uppercase" }}
                >
                    {text}
                </text>

                {/* Main text fill */}
                <text
                    x={estimatedWidth / 2}
                    y={estimatedHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={COLORS.textFill}
                    fontFamily="Arial Black, Arial, sans-serif"
                    fontSize="30"
                    fontWeight="900"
                    letterSpacing="1.5"
                    style={{ textTransform: "uppercase" }}
                >
                    {text}
                </text>
            </svg>
        </div>
    );
}

const speechBubbleVariants = tv({
    base: "absolute top-2 left-0 border-2 border-orange-950 shadow-md rounded-[6px] [corner-shape:scoop]",
    variants: {
        direction: {
            left: "left-0",
            right: "right-0",
        },
    },
});

export function SpeechBubble2({ direction = "left", text }: SpeechBubbleProps) {
    const variants = speechBubbleVariants({ direction });

    return (
        <div data-component="SpeechBubble" className={variants}>
            <div className="border-1 border-orange-700 rounded-[5px] [corner-shape:scoop] bg-background select-none">
                <div className="border-2 border-orange-500 p-2 rounded-[4px] [corner-shape:scoop]">
                    <div className="text-[48px] uppercase font-pixelated text-[#E83A30] tracking-widest text-shadow-[2px_2px_#3a2d2d,-2px_2px_#3a2d2d,2px_-2px_#3a2d2d,-2px_-2px_#3a2d2d,2px_0px_#3a2d2d,-2px_0px_#3a2d2d,0px_2px_#3a2d2d,0px_-2px_#3a2d2d]">
                        {text}
                    </div>
                </div>
            </div>
            {/* <div data-slot="arrow" className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-orange-500"></div> */}
            <div className="absolute left-[-4px] bottom-[3px]">
                <div
                    data-slot="arrow"
                    className="absolute transform translate-y-[2px] translate-x-[-2px] skew-x-[-45deg] w-0 h-0 border-20 border-transparent border-t-black border-l-black"
                ></div>
                <div
                    data-slot="arrow"
                    className="absolute transform translate-x-[6px] skew-x-[-45deg] w-0 h-0 border-16 border-transparent border-t-orange-500 border-l-orange-500"
                ></div>
                <div
                    data-slot="arrow"
                    className="absolute transform translate-x-[12px] skew-x-[-45deg] w-0 h-0 border-12 border-transparent border-t-background border-l-background"
                ></div>
            </div>
        </div>
    );
}
