/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

type PPEItemDfn = {
    id: string;
    name: string;
    hasSize: boolean;
    hasSerialNumber: boolean;
    sizeOptions?: string[];
};

export const PPEItemCatalogue: PPEItemDfn[] = [
    {
        id: "boots",
        name: "Boots",
        hasSize: true,
        hasSerialNumber: false,
        sizeOptions: ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
    },

    {
        id: "gloves",
        name: "Gloves",
        hasSize: true,
        hasSerialNumber: false,
        sizeOptions: ["S", "M", "L", "XL"],
    },
    { id: "goggles", name: "Goggles", hasSize: false, hasSerialNumber: false },
    { id: "helmet", name: "Helmet", hasSize: false, hasSerialNumber: true },
    {
        id: "knee-pads",
        name: "Knee Pads",
        hasSize: false,
        hasSerialNumber: false,
    },
    {
        id: "uniform-jacket",
        name: "Jacket (Uniform)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "ww-jacket",
        name: "Jacket (Wet Weather)",
        hasSize: true,
        hasSerialNumber: false,
    },

    {
        id: "probationary-overalls",
        name: "Overalls (Probationary)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "uniform-overall",
        name: "Overalls (Standard)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "uniform-pants",
        name: "Pants (Uniform)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "ww-pants",
        name: "Pants (Wet Weather)",
        hasSize: true,
        hasSerialNumber: false,
    },
];
