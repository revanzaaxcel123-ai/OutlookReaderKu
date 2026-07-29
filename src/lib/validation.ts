export interface ParsedCredential {
  email: string
  password: string
  passwordIgnored: true
  refreshToken: string
  clientId: string
}

export function parseCredentialString(raw: string): ParsedCredential {
  const trimmed = raw.trim()
  const delimiter = trimmed.includes("|") ? "|" : ":"
  const parts = trimmed.split(delimiter)

  if (parts.length !== 4) {
    throw new Error("Invalid credential format. Expected email:password:refresh_token:client_id (or delimited with |)")
  }

  const [email, password, refreshToken, clientId] = parts

  if (!email.includes("@")) {
    throw new Error("Invalid email format.")
  }

  if (refreshToken.length < 10 || clientId.length < 10) {
    throw new Error("Invalid token or client ID length.")
  }

  return {
    email,
    password,
    passwordIgnored: true,
    refreshToken,
    clientId
  }
}

export function formatCredentialString(cred: ParsedCredential): string {
  return `${cred.email}:${cred.password}:${cred.refreshToken}:${cred.clientId}`
}

