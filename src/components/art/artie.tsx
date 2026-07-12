/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { cn } from "@/lib/utils";
import Image from "next/image";

type ArtiePose =
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

const poseToImage: Record<ArtiePose, string> = {
    CheckThisOut: "/mascot/artie-check-this-out.png",
    Empty: "/mascot/artie-empty-transparent.png",
    Error: "/mascot/artie-error.png",
    Login: "/mascot/artie-login.png",
    NotAllowed: "/mascot/artie-not-allowed.png",
    NotFound: "/mascot/artie-not-found.png",
    Question: "/mascot/artie-question.png",
    Searching: "/mascot/artie-searching.png",
    Secure: "/mascot/artie-secure.png",
    Success: "/mascot/artie-success.png",
    Welcome: "/mascot/artie-welcome.png",
    Working: "/mascot/artie-working.png",
    Writing: "/mascot/artie-writing.png",
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
    const imageSrc = poseToImage[pose];
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
                src={imageSrc}
                alt={altText}
                width={1184}
                height={864}
                priority={false}
                className={cn("object-contain select-none")}
                loading="eager"
            />
        </div>
    );
}
