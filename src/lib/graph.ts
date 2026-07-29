import type { ParsedCredential } from "./validation"

export interface TokenResponse {
    accessToken: string
    expiresIn: number
    refreshToken?: string
}

export interface InboxMessage {
    id: string
    subject: string
    from: string
    bodyPreview: string
    receivedDateTime: string
    isRead: boolean
}

export interface InboxResponse {
    messages: InboxMessage[]
    nextLink?: string
}

export interface MessageDetail {
    id: string
    subject: string
    from: string
    toRecipients: string[]
    bodyPreview: string
    bodyHtmlRaw: string
    bodyHtmlSanitized?: string // populated by UI
}

const USE_PROXY = import.meta.env.VITE_USE_OAUTH_PROXY === "true" || (import.meta.env.DEV && import.meta.env.VITE_USE_OAUTH_PROXY !== "false")
const LIVE_TOKEN_URL = USE_PROXY ? "/api/token" : (import.meta.env.VITE_TOKEN_URL || "https://login.live.com/oauth20_token.srf")

/**
 * Exchanges the refresh token for a new access token using the Live SDK OAuth2 endpoint.
 * Matches Python requests.post('https://login.live.com/oauth20_token.srf', data={client_id, grant_type, refresh_token}).
 */
export async function exchangeRefreshToken(account: ParsedCredential): Promise<TokenResponse> {
    const body = new URLSearchParams()
    body.append("client_id", account.clientId)
    body.append("grant_type", "refresh_token")
    body.append("refresh_token", account.refreshToken)

    const res = await fetch(LIVE_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
        const errorDesc = data.error_description || data.error || res.statusText || "Token exchange failed"
        console.error("[OAuth Exchange Error]:", data)
        throw new Error(errorDesc)
    }

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token || account.refreshToken,
    }
}

export async function fetchInbox(email: string, accessToken: string): Promise<InboxResponse> {
    const res = await fetch("/api/imap/inbox", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, accessToken }),
    })

    if (!res.ok) {
        if (res.status === 401) {
            throw new Error("UNAUTHORIZED_ACCESS_TOKEN")
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch IMAP inbox")
    }

    const data = await res.json()
    return {
        messages: data.messages,
    }
}

export async function fetchMessageDetail(email: string, accessToken: string, messageId: string): Promise<MessageDetail> {
    const res = await fetch("/api/imap/detail", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, accessToken, messageId }),
    })

    if (!res.ok) {
        if (res.status === 401) {
            throw new Error("UNAUTHORIZED_ACCESS_TOKEN")
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch IMAP message detail")
    }

    return res.json()
}
