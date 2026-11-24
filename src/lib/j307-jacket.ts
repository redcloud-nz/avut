/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The soft shell jacket the team is considering: Biz Collection Geneva J307. Sizes and
 * half-chest measurements are from the maker's J307 style sheet (5XL left out for now: the sheet
 * has no 4XL, so it's unconfirmed). Photos in `public/forms/jacket/` are the maker's, with the NZRT
 * branding mocked up on them: the white stacked logo (NZRT Brand Guidelines, variant 3) on the
 * left breast, and NEW ZEALAND RESPONSE TEAM / CHRISTCHURCH across the back (Arial Black standing
 * in for Franklin Gothic Heavy).
 */

/** One fit (Men's, Ladies'), its sizes from the maker's chart, and its photos. */
export type J307Fit = {
    id: string;
    label: string;
    sizes: { size: string; /** Garment half-chest in cm. */ halfChestCm?: number }[];
    images: { front: JacketImage; back: JacketImage };
};

export type JacketImage = { src: string; width: number; height: number; alt: string };

/** The teams the jacket interest form is for. */
export const JACKET_TEAMS = ["NZ-RT10", "NZ-RT11", "NZ-RT14"] as const;
export type JacketTeam = (typeof JACKET_TEAMS)[number];

export const J307_JACKET = {
    name: "Soft shell jacket",
    maker: "Biz Collection",
    model: "Geneva J307",
    summary:
        "A light, stretchy softshell with a fleece lining: water repellent and breathable, warm without overheating, and not bulky, so it's fine indoors or driving.",
    features: [
        "Softshell with a breathable inner membrane (BizTech)",
        "Lighter and stretchier than a traditional shell",
        "Water repellent to 3,000 mm",
        "Breathable: warm without overheating",
        "Not bulky: comfortable indoors or driving",
        "100% polyester outer, bonded micro-ribbed fleece lining",
    ],
    fits: [
        {
            id: "mens",
            label: "Men's",
            sizes: [
                { size: "S", halfChestCm: 57 },
                { size: "M", halfChestCm: 59 },
                { size: "L", halfChestCm: 61 },
                { size: "XL", halfChestCm: 63 },
                { size: "2XL", halfChestCm: 65 },
                { size: "3XL", halfChestCm: 70 },
            ],
            images: {
                front: {
                    src: "/forms/jacket/j307-mens-front.webp",
                    width: 689,
                    height: 623,
                    alt: "Men's J307 soft shell jacket, front, with the NZRT logo on the left breast",
                },
                back: {
                    src: "/forms/jacket/j307-mens-back.webp",
                    width: 666,
                    height: 628,
                    alt: "Men's J307 soft shell jacket, back, with NEW ZEALAND RESPONSE TEAM, CHRISTCHURCH across the shoulders",
                },
            },
        },
        {
            id: "ladies",
            label: "Ladies'",
            sizes: [
                { size: "S", halfChestCm: 49 },
                { size: "M", halfChestCm: 52.5 },
                { size: "L", halfChestCm: 56 },
                { size: "XL", halfChestCm: 59.5 },
                { size: "2XL", halfChestCm: 63 },
            ],
            images: {
                front: {
                    src: "/forms/jacket/j307-ladies-front.webp",
                    width: 672,
                    height: 611,
                    alt: "Ladies' J307 soft shell jacket, front, with the NZRT logo on the left breast",
                },
                back: {
                    src: "/forms/jacket/j307-ladies-back.webp",
                    width: 644,
                    height: 625,
                    alt: "Ladies' J307 soft shell jacket, back, with NEW ZEALAND RESPONSE TEAM, CHRISTCHURCH across the shoulders",
                },
            },
        },
    ] satisfies J307Fit[],
};
