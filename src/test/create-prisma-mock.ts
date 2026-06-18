import createPrismaMock from "prisma-mock/client";

import { Prisma, PrismaClient } from "@/generated/prisma/client";
import * as dmmf from "@/generated/dmmf";

export function createMockPrisma(): PrismaClient {
    return createPrismaMock(Prisma as never, {
        datamodel: dmmf as never,
    }) as unknown as PrismaClient;
}
