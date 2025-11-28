/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

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
    pose: ArtiePose;
    size?: "sm" | "md" | "lg";
    alt?: string;
}

const poseToImage: Record<ArtiePose, string> = {
    CheckThisOut: "/artie/artie-check-this-out.png",
    Empty: "/artie/artie-empty-transparent.png",
    Error: "/artie/artie-error.png",
    Login: "/artie/artie-login.png",
    NotAllowed: "/artie/artie-not-allowed.png",
    NotFound: "/artie/artie-not-found.png",
    Question: "/artie/artie-question.png",
    Searching: "/artie/artie-searching.png",
    Secure: "/artie/artie-secure.png",
    Success: "/artie/artie-success.png",
    Welcome: "/artie/artie-welcome.png",
    Working: "/artie/artie-working.png",
    Writing: "/artie/artie-writing.png",
};

// const sizeConfig = {
//     sm: { width: 200, height: 200 },
//     md: { width: 300, height: 300 },
//     lg: { width: 400, height: 400 },
// }

/**
 * Component to render Artie illustrations.
 */
export default function Artie({ pose, alt }: ArtieProps) {
    const imageSrc = poseToImage[pose];
    const altText = alt || `Artie the mascot - ${pose}`;

    return (
        <Image
            src={imageSrc}
            alt={altText}
            width={1184}
            height={864}
            priority={false}
            className="object-contain select-none"
        />
    );
}
