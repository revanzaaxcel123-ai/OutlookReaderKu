import { describe, it, expect } from "vitest"
import { parseCredentialString, formatCredentialString } from "./validation"

describe("parseCredentialString", () => {
    it("successfully parses a valid 4-part credential string", () => {
        const input = "test@example.com:password123:eyRefresh123:azure-client-id"
        const result = parseCredentialString(input)

        expect(result.email).toBe("test@example.com")
        expect(result.password).toBe("password123")
        expect(result.passwordIgnored).toBe(true)
        expect(result.refreshToken).toBe("eyRefresh123")
        expect(result.clientId).toBe("azure-client-id")
    })

    it("successfully parses a valid 4-part pipe-delimited credential string", () => {
        const input = "test@example.com|password123|eyRefresh123|azure-client-id"
        const result = parseCredentialString(input)

        expect(result.email).toBe("test@example.com")
        expect(result.password).toBe("password123")
        expect(result.passwordIgnored).toBe(true)
        expect(result.refreshToken).toBe("eyRefresh123")
        expect(result.clientId).toBe("azure-client-id")
    })

    it("throws an error when string is empty or invalid format", () => {
        expect(() => parseCredentialString("")).toThrow("Invalid credential format. Expected email:password:refresh_token:client_id (or delimited with |)")
        // Only 3 parts
        expect(() => parseCredentialString("test@example.com:password123:eyRefresh")).toThrow("Invalid credential format. Expected email:password:refresh_token:client_id (or delimited with |)")
    })

    it("throws an error when email format is invalid", () => {
        expect(() => parseCredentialString("testexample.com:password123:eyRefresh123:azure-client-id")).toThrow("Invalid email format.")
    })

    it("throws an error when token or client ID is too short", () => {
        expect(() => parseCredentialString("test@example.com:password123:short:azure-client-id")).toThrow("Invalid token or client ID length.")
        expect(() => parseCredentialString("test@example.com:password123:eyRefresh123:short")).toThrow("Invalid token or client ID length.")
    })

    it("formats a ParsedCredential back to credential string", () => {
        const cred = {
            email: "user@domain.com",
            password: "mypassword",
            passwordIgnored: true as const,
            refreshToken: "refresh_token_value_12345",
            clientId: "client_id_12345"
        }
        expect(formatCredentialString(cred)).toBe("user@domain.com:mypassword:refresh_token_value_12345:client_id_12345")
    })
})

