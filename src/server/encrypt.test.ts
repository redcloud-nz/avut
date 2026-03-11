/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    encryptValue,
    decryptValue,
    encryptDBValue,
    decryptDBValue,
} from "./encrypt";

describe("encrypt", () => {
    const validSecret = "a".repeat(32); // 32 characters for AES-256

    describe("encryptValue & decryptValue reciprocal", () => {
        it("should decrypt to original plaintext for simple text", () => {
            const plaintext = "Hello, World!";
            const encrypted = encryptValue(plaintext, validSecret);
            const decrypted = decryptValue(encrypted, validSecret);
            expect(decrypted).toBe(plaintext);
        });

        it("should decrypt to original plaintext for empty string", () => {
            const plaintext = "";
            const encrypted = encryptValue(plaintext, validSecret);
            const decrypted = decryptValue(encrypted, validSecret);
            expect(decrypted).toBe(plaintext);
        });

        it("should decrypt to original plaintext for special characters", () => {
            const plaintext = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`";
            const encrypted = encryptValue(plaintext, validSecret);
            const decrypted = decryptValue(encrypted, validSecret);
            expect(decrypted).toBe(plaintext);
        });

        it("should decrypt to original plaintext for unicode characters", () => {
            const plaintext = "Hello 世界 🌍 Привет";
            const encrypted = encryptValue(plaintext, validSecret);
            const decrypted = decryptValue(encrypted, validSecret);
            expect(decrypted).toBe(plaintext);
        });

        it("should decrypt to original plaintext for long text", () => {
            const plaintext = "a".repeat(10000);
            const encrypted = encryptValue(plaintext, validSecret);
            const decrypted = decryptValue(encrypted, validSecret);
            expect(decrypted).toBe(plaintext);
        });

        it("should produce different ciphertexts for same plaintext (IV randomness)", () => {
            const plaintext = "Same text";
            const encrypted1 = encryptValue(plaintext, validSecret);
            const encrypted2 = encryptValue(plaintext, validSecret);
            expect(encrypted1).not.toBe(encrypted2);
        });
    });

    describe("encryptDBValue & decryptDBValue reciprocal", () => {
        beforeEach(() => {
            process.env.DB_ENCRYPTION_SECRET = validSecret;
        });

        it("should decrypt to original plaintext with DB functions", () => {
            const plaintext = "Database secret";
            const encrypted = encryptDBValue(plaintext);
            const decrypted = decryptDBValue(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it("should work with JSON strings", () => {
            const plaintext = JSON.stringify({ user: "test", role: "admin" });
            const encrypted = encryptDBValue(plaintext);
            const decrypted = decryptDBValue(encrypted);
            expect(decrypted).toBe(plaintext);
            expect(JSON.parse(decrypted)).toEqual({
                user: "test",
                role: "admin",
            });
        });
    });

    describe("encryptValue validation", () => {
        it("should throw error for missing secret", () => {
            expect(() => encryptValue("text", "")).toThrow(
                "Invalid encryption secret",
            );
        });

        it("should throw error for secret with incorrect length", () => {
            expect(() => encryptValue("text", "short")).toThrow(
                "Invalid encryption secret",
            );
        });
    });

    describe("decryptValue validation", () => {
        it("should throw error for missing secret", () => {
            expect(() => decryptValue("ciphertext", "")).toThrow(
                "Invalid encryption secret",
            );
        });

        it("should throw error for secret with incorrect length", () => {
            expect(() => decryptValue("ciphertext", "short")).toThrow(
                "Invalid encryption secret",
            );
        });

        it("should throw error for invalid ciphertext", () => {
            expect(() => decryptValue("invalidbase64!", validSecret)).toThrow();
        });

        it("should throw error if authentication tag verification fails", () => {
            const plaintext = "Original";
            const encrypted = encryptValue(plaintext, validSecret);
            const tampered = Buffer.from(encrypted, "base64");
            tampered[0] ^= 0xff; // Flip bits in first byte
            const tamperedEncrypted = tampered.toString("base64");

            expect(() =>
                decryptValue(tamperedEncrypted, validSecret),
            ).toThrow();
        });
    });

    describe("encryptDBValue & decryptDBValue validation", () => {
        it("should throw error if DB_ENCRYPTION_SECRET is not set", () => {
            delete process.env.DB_ENCRYPTION_SECRET;
            expect(() => encryptDBValue("text")).toThrow(
                "DB_ENCRYPTION_SECRET environment variable is not set",
            );
        });

        it("should throw error on decrypt if DB_ENCRYPTION_SECRET is not set", () => {
            delete process.env.DB_ENCRYPTION_SECRET;
            expect(() => decryptDBValue("ciphertext")).toThrow(
                "DB_ENCRYPTION_SECRET environment variable is not set",
            );
        });
    });
});
