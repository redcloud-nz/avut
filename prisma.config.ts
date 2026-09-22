/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Configuration for Prisma ORM.
 */

import "dotenv/config";

import { defineConfig, env } from "prisma/config";

// `prisma generate` (the `postinstall` hook) never opens a connection, but the config fails to load
// when the URL can't be resolved, and `dotenv/config` only reads `.env` — not `.env.local`. So a bare
// `npm install` used to fail unless the shell happened to export the URL. Give `generate` — and only
// `generate` — a placeholder that can't connect; every other command (`migrate`, `studio`, …) still
// fails loudly when the URL is missing rather than reaching for a database by accident.
const GENERATE_PLACEHOLDER_URL =
    "postgresql://placeholder:placeholder@placeholder.invalid:5432/placeholder";

const url = process.argv.includes("generate")
    ? (process.env.POSTGRES_PRISMA_URL ?? GENERATE_PLACEHOLDER_URL)
    : env("POSTGRES_PRISMA_URL");

export default defineConfig({
    schema: "./prisma/schema.prisma",
    migrations: {
        path: "./prisma/migrations",
    },
    datasource: { url },
});
