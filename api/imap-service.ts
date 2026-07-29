import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"

export interface ImapMessageSummary {
    id: string
    seq: number
    subject: string
    from: string
    bodyPreview: string
    receivedDateTime: string
    isRead: boolean
    folder: string
}

export interface ImapMessageDetail {
    id: string
    seq: number
    subject: string
    from: string
    toRecipients: string[]
    bodyPreview: string
    bodyHtmlRaw: string
    folder: string
}

const IMAP_HOST = "outlook.office365.com"
const IMAP_PORT = 993

/**
 * Connects to outlook.office365.com over TLS (port 993) using XOAUTH2 bearer token authentication.
 * Searches INBOX and JUNK folders and returns message summaries matching the Python script logic.
 */
export async function getImapInbox(email: string, accessToken: string): Promise<ImapMessageSummary[]> {
    const client = new ImapFlow({
        host: IMAP_HOST,
        port: IMAP_PORT,
        secure: true,
        auth: {
            user: email,
            accessToken: accessToken,
        },
        logger: false,
    })

    await client.connect()
    const allMessages: ImapMessageSummary[] = []

    const foldersToScan = ["INBOX", "Junk", "JUNK"]

    try {
        const scannedFolders = new Set<string>()

        for (const folderName of foldersToScan) {
            let lock
            try {
                lock = await client.getMailboxLock(folderName)
            } catch {
                continue // folder might not exist on server
            }

            const canonicalName = lock.path || folderName
            if (scannedFolders.has(canonicalName)) {
                lock.release()
                continue
            }
            scannedFolders.add(canonicalName)

            try {
                if (!client.mailbox || !client.mailbox.exists || client.mailbox.exists === 0) {
                    // Empty folder - skip sequence fetch to prevent IMAP NO "Command failed"
                    continue
                }

                const range = client.mailbox.exists === 1 ? "1" : `1:${client.mailbox.exists}`
                const messagesGenerator = client.fetch(range, {
                    uid: true,
                    flags: true,
                    envelope: true,
                    bodyStructure: true,
                })

                for await (const msg of messagesGenerator) {
                    const subject = msg.envelope?.subject || "(No Subject)"
                    const fromObj = msg.envelope?.from?.[0]
                    const from = fromObj ? (fromObj.name ? `${fromObj.name} <${fromObj.address}>` : fromObj.address || "Unknown") : "Unknown"
                    const isRead = msg.flags?.has("\\Seen") || false
                    const date = msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString()
                    const id = `${canonicalName}:${msg.uid}`

                    allMessages.push({
                        id,
                        seq: msg.seq,
                        subject,
                        from,
                        bodyPreview: "",
                        receivedDateTime: date,
                        isRead,
                        folder: canonicalName,
                    })
                }
            } catch (err) {
                console.error(`[IMAP Fetch Error in ${folderName}]:`, err)
            } finally {
                lock.release()
            }
        }
    } finally {
        await client.logout()
    }

    // Sort by date descending
    return allMessages.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime())
}

/**
 * Fetches full RFC822 email content for a specific message UID and parses HTML/text payload.
 */
export async function getImapMessageDetail(email: string, accessToken: string, messageId: string): Promise<ImapMessageDetail> {
    const parts = messageId.split(":")
    if (parts.length !== 2) throw new Error("Invalid messageId format. Expected folder:uid")

    const folderName = parts[0]
    const uid = parseInt(parts[1], 10)

    const client = new ImapFlow({
        host: IMAP_HOST,
        port: IMAP_PORT,
        secure: true,
        auth: {
            user: email,
            accessToken: accessToken,
        },
        logger: false,
    })

    await client.connect()

    try {
        const lock = await client.getMailboxLock(folderName)
        try {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
            if (!msg || !msg.source) {
                throw new Error("Failed to download message source from IMAP server")
            }

            const parsed = await simpleParser(msg.source)

            const subject = parsed.subject || "(No Subject)"
            const from = parsed.from?.text || "Unknown Sender"
            const toRecipients = Array.isArray(parsed.to)
                ? parsed.to.map((t) => t.text)
                : parsed.to?.text
                ? [parsed.to.text]
                : []

            const bodyHtmlRaw = (parsed.html as string) || (parsed.textAsHtml as string) || (parsed.text as string) || ""
            const bodyPreview = parsed.text ? parsed.text.substring(0, 150).replace(/\s+/g, " ") : ""

            return {
                id: messageId,
                seq: uid,
                subject,
                from,
                toRecipients,
                bodyPreview,
                bodyHtmlRaw,
                folder: folderName,
            }
        } finally {
            lock.release()
        }
    } finally {
        await client.logout()
    }
}
