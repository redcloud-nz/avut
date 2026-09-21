import createPrismaMock from "prisma-mock/client";

import * as dmmf from "@/generated/dmmf";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export function createMockPrisma(): PrismaClient {
    return createPrismaMock(Prisma as never, {
        datamodel: dmmf as never,
    }) as unknown as PrismaClient;
}
