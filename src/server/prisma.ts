/*
 *  Copyright (c) 2025 A.V.U.T. Project
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const prismaClientSingleton = () => {
    const adapter = new PrismaPg({
        connectionString: process.env.POSTGRES_PRISMA_URL,
    });
    return new PrismaClient({ adapter });
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
