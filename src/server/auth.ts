/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
*/

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { organization } from 'better-auth/plugins/organization'

import { nanoId16 } from '@/lib/id'
import { ac, owner, admin, member } from '@/lib/permissions'

import prisma from './prisma'


export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true
        }
    },
    advanced: {
        database: {
            generateId: nanoId16
        }
    },
    database: prismaAdapter(prisma, {
        provider: 'postgresql',
    }),
    

    emailAndPassword: {
        enabled: true
    },
    experimental: {
        joins: true
    },

    plugins: [
        organization({
            ac,
            roles: { owner, admin, member},
            teams: {
                enabled: true,
            }
        })
    ],

    user: {
        modelName: 'users',

    }
})