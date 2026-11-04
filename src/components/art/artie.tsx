/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import Image from "next/image";

import { cn } from "@/lib/utils";

export type ArtiePose =
    | "CheckThisOut"
    | "Empty"
    | "Error"
    | "Login"
    | "NotAllowed"
    | "NotFound"
    | "Question"
    | "Searching"
    | "Secure"
    | "Success"
    | "Welcome"
    | "Working"
    | "Writing";

interface ArtieProps {
    className?: string;
    pose: ArtiePose;
    size?: "sm" | "md" | "lg";
    alt?: string;
}

// Transparent cutouts: the page background shows through, so they suit both themes.
const poseToImage: Record<ArtiePose, { src: string; width: number; height: number }> = {
    CheckThisOut: { src: "/mascot/artie-check-this-out.png", width: 1184, height: 864 },
    Empty: { src: "/mascot/artie-empty.png", width: 1184, height: 864 },
    Error: { src: "/mascot/artie-error.png", width: 1184, height: 864 },
    Login: { src: "/mascot/artie-login.png", width: 1184, height: 864 },
    NotAllowed: { src: "/mascot/artie-not-allowed.png", width: 1184, height: 864 },
    NotFound: { src: "/mascot/artie-not-found.png", width: 1184, height: 864 },
    Question: { src: "/mascot/artie-question.png", width: 1184, height: 864 },
    Searching: { src: "/mascot/artie-searching.png", width: 1024, height: 1024 },
    Secure: { src: "/mascot/artie-secure.png", width: 1184, height: 864 },
    Success: { src: "/mascot/artie-success.png", width: 1184, height: 864 },
    Welcome: { src: "/mascot/artie-welcome.png", width: 1184, height: 864 },
    Working: { src: "/mascot/artie-working.png", width: 1184, height: 864 },
    Writing: { src: "/mascot/artie-writing.png", width: 1184, height: 864 },
};

// const sizeConfig = {
//     sm: { width: 200, height: 200 },
//     md: { width: 300, height: 300 },
//     lg: { width: 400, height: 400 },
// }

/**
 * Component to render Artie illustrations.
 */
export default function Artie({ pose, alt, className, size = "md" }: ArtieProps) {
    const image = poseToImage[pose];
    const altText = alt || `Artie the mascot - ${pose}`;

    return (
        <div
            data-slot="mascot"
            data-pose={pose}
            data-size={size}
            className={cn(
                "data-[size=sm]:w-[300px] data-[size=md]:w-[600px] data-[size=lg]:w-[600px]",
                className,
            )}
        >
            <Image
                src={image.src}
                alt={altText}
                width={image.width}
                height={image.height}
                priority={false}
                className={cn("object-contain select-none")}
                loading="eager"
            />
        </div>
    );
}
