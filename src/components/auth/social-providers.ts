/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";

/**
 * The social providers configured in `src/server/auth.ts`.
 *
 * Single source of truth for the sign-in buttons and the linked-accounts card, so adding
 * a provider is one edit here plus the matching entry in `auth.ts` — rather than two
 * hardcoded lists that drift apart.
 */
export const SocialProviders = [
    { id: "github", name: "GitHub", Icon: SiGithub },
    { id: "google", name: "Google", Icon: SiGoogle },
] as const;

export type SocialProvider = (typeof SocialProviders)[number];

export type SocialProviderId = SocialProvider["id"];
