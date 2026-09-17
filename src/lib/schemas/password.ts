/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/**
 * A new password being set or changed. Capped below Better Auth's own 128-character default so
 * client-side validation never accepts a password the server will then reject.
 */
export const PasswordSchema = z
    .string()
    .nonempty({ message: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters");

/**
 * The "type it again" field paired with `PasswordSchema`. Left to a bare non-empty check so a
 * length mismatch surfaces as the `.refine()` "Passwords do not match" error on this field,
 * rather than a misleading length error before the two have even been compared.
 */
export const ConfirmPasswordSchema = z
    .string()
    .nonempty({ message: "Please confirm your password" });

/** An already-set password supplied for verification (e.g. change-password's current password). */
export const ExistingPasswordSchema = z
    .string()
    .nonempty({ message: "Current password is required" })
    .max(100, "Password must be at most 100 characters");
