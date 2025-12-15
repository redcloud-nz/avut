/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Configuration for Prisma ORM.
 */

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: "./prisma/schema.prisma",
    migrations: {
        path: "./prisma/migrations",
    },
    datasource: {
        url: env("POSTGRES_PRISMA_URL"),
    },
});
