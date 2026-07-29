import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { decryptAccount, encryptAccount, type EncryptedAccountRecord } from "@/lib/crypto"
import { parseCredentialString, type ParsedCredential } from "@/lib/validation"

interface VaultState {
    isLocked: boolean
    hasVault: boolean
    isEphemeral: boolean
    accounts: EncryptedAccountRecord[]
    activeAccountId: string | null

    // Decrypted session state (never persisted)
    decryptedAccounts: Record<string, ParsedCredential>
    sessionPassphrase: string | null

    // Actions
    initializeVault: (passphrase: string, ephemeral?: boolean) => Promise<boolean>
    unlockVault: (passphrase: string) => Promise<boolean>
    lockVault: () => void
    addAccount: (credentialString: string, passphrase: string) => Promise<void>
    removeAccount: (accountId: string) => void
    setActiveAccount: (accountId: string) => void
    updateAccountRefreshToken: (accountId: string, newRefreshToken: string) => Promise<void>
    getExportString: (accountId?: string) => string
}

export const useVaultStore = create<VaultState>()(
    persist(
        (set, get) => ({
            isLocked: true,
            hasVault: false,
            isEphemeral: false,
            accounts: [],
            activeAccountId: null,
            decryptedAccounts: {},
            sessionPassphrase: null,

            initializeVault: async (passphrase: string, ephemeral = false) => {
                set({ isLocked: false, hasVault: true, isEphemeral: ephemeral, sessionPassphrase: passphrase })
                return true
            },

            unlockVault: async (passphrase: string) => {
                const { accounts } = get()
                if (accounts.length === 0) {
                    set({ isLocked: false, sessionPassphrase: passphrase })
                    return true
                }

                try {
                    const decrypted: Record<string, ParsedCredential> = {}
                    for (const acc of accounts) {
                        decrypted[acc.id] = await decryptAccount(acc, passphrase)
                    }
                    set({ isLocked: false, decryptedAccounts: decrypted, sessionPassphrase: passphrase })
                    return true
                } catch (e) {
                    return false
                }
            },

            lockVault: () => {
                // Secure memory wipe of decrypted accounts and session passphrase
                set({ isLocked: true, decryptedAccounts: {}, sessionPassphrase: null, activeAccountId: null })
            },

            addAccount: async (credentialString: string, passphrase: string) => {
                if (get().isLocked) throw new Error("Vault is locked")

                const parsed = parseCredentialString(credentialString)
                const encrypted = await encryptAccount(parsed, passphrase)

                set((state) => ({
                    hasVault: true,
                    accounts: [...state.accounts, encrypted],
                    decryptedAccounts: { ...state.decryptedAccounts, [encrypted.id]: parsed },
                    sessionPassphrase: passphrase,
                    activeAccountId: encrypted.id
                }))
            },

            removeAccount: (accountId: string) => {
                set((state) => {
                    const newAccounts = state.accounts.filter(a => a.id !== accountId)
                    const newDecrypted = { ...state.decryptedAccounts }
                    delete newDecrypted[accountId]
                    return {
                        accounts: newAccounts,
                        decryptedAccounts: newDecrypted,
                        activeAccountId: state.activeAccountId === accountId
                            ? (newAccounts.length > 0 ? newAccounts[0].id : null)
                            : state.activeAccountId,
                        hasVault: newAccounts.length > 0
                    }
                })
            },

            setActiveAccount: (accountId: string) => set({ activeAccountId: accountId }),

            updateAccountRefreshToken: async (accountId: string, newRefreshToken: string) => {
                const state = get()
                if (state.isLocked) return

                const currentCred = state.decryptedAccounts[accountId]
                if (!currentCred || currentCred.refreshToken === newRefreshToken) return

                const updatedCred: ParsedCredential = {
                    ...currentCred,
                    refreshToken: newRefreshToken,
                }

                const passphrase = state.sessionPassphrase || ""
                const updatedAccounts = [...state.accounts]

                if (passphrase) {
                    const existingAcc = state.accounts.find((a) => a.id === accountId)
                    if (existingAcc) {
                        const reEncrypted = await encryptAccount(updatedCred, passphrase, accountId)
                        const idx = updatedAccounts.findIndex((a) => a.id === accountId)
                        if (idx !== -1) {
                            updatedAccounts[idx] = reEncrypted
                        }
                    }
                }

                set((prev) => ({
                    accounts: updatedAccounts,
                    decryptedAccounts: {
                        ...prev.decryptedAccounts,
                        [accountId]: updatedCred,
                    },
                }))
            },

            getExportString: (accountId?: string) => {
                const state = get()
                if (state.isLocked) return ""

                const formatAccount = (id: string) => {
                    const cred = state.decryptedAccounts[id]
                    if (!cred) return ""
                    return `${cred.email}:${cred.password}:${cred.refreshToken}:${cred.clientId}`
                }

                if (accountId) {
                    return formatAccount(accountId)
                }

                return state.accounts
                    .map((acc) => formatAccount(acc.id))
                    .filter(Boolean)
                    .join("\n")
            }
        }),
        {
            name: "outlookreader-vault",
            // Only persist encrypted records and flags, NEVER the decrypted session state
            partialize: (state) => ({
                hasVault: state.hasVault,
                isEphemeral: state.isEphemeral,
                accounts: state.accounts,
                activeAccountId: state.activeAccountId
            }),
            storage: createJSONStorage(() => ({
                getItem: (name: string) => {
                    return sessionStorage.getItem(name) || localStorage.getItem(name)
                },
                setItem: (name: string, value: string) => {
                    try {
                        const parsed = JSON.parse(value)
                        if (parsed?.state?.isEphemeral) {
                            sessionStorage.setItem(name, value)
                            // Clean up local storage if it previously existed
                            localStorage.removeItem(name)
                        } else {
                            localStorage.setItem(name, value)
                            sessionStorage.removeItem(name)
                        }
                    } catch {
                        localStorage.setItem(name, value)
                    }
                },
                removeItem: (name: string) => {
                    localStorage.removeItem(name)
                    sessionStorage.removeItem(name)
                }
            }))
        }
    )
)
