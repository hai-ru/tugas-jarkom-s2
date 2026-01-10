// Crypto Library for Client-Side Encryption

class CryptoLib {
    constructor() {
        this.publicKey = null;
        this.privateKey = null;
    }

    // Generate RSA key pair
    async generateRSAKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );

        this.publicKey = keyPair.publicKey;
        this.privateKey = keyPair.privateKey;

        return keyPair;
    }

    // Export public key to PEM format
    async exportPublicKey() {
        const exported = await window.crypto.subtle.exportKey("spki", this.publicKey);
        const exportedAsString = this.arrayBufferToBase64(exported);
        const pemExported = `-----BEGIN PUBLIC KEY-----\n${this.formatPEM(exportedAsString)}\n-----END PUBLIC KEY-----`;
        return pemExported;
    }

    // Import public key from PEM format
    async importPublicKey(pem) {
        const pemHeader = "-----BEGIN PUBLIC KEY-----";
        const pemFooter = "-----END PUBLIC KEY-----";
        const pemContents = pem.substring(
            pemHeader.length,
            pem.length - pemFooter.length
        ).replace(/\s/g, '');
        
        const binaryDer = this.base64ToArrayBuffer(pemContents);
        
        return await window.crypto.subtle.importKey(
            "spki",
            binaryDer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            true,
            ["encrypt"]
        );
    }

    // Generate AES key
    async generateAESKey() {
        return await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // Encrypt AES key with RSA public key
    async encryptAESKey(aesKey, rsaPublicKey) {
        const exported = await window.crypto.subtle.exportKey("raw", aesKey);
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            rsaPublicKey,
            exported
        );
        return this.arrayBufferToBase64(encrypted);
    }

    // Decrypt AES key with RSA private key
    async decryptAESKey(encryptedKey) {
        const encrypted = this.base64ToArrayBuffer(encryptedKey);
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP"
            },
            this.privateKey,
            encrypted
        );
        
        return await window.crypto.subtle.importKey(
            "raw",
            decrypted,
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // Encrypt message with AES
    async encryptMessage(message, aesKey) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            aesKey,
            data
        );
        
        // Combine IV and ciphertext
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return this.arrayBufferToBase64(combined);
    }

    // Decrypt message with AES
    async decryptMessage(encryptedMessage, aesKey) {
        const combined = this.base64ToArrayBuffer(encryptedMessage);
        
        // Extract IV and ciphertext
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            aesKey,
            ciphertext
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    // Helper: ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
        const binary = String.fromCharCode(...new Uint8Array(buffer));
        return window.btoa(binary);
    }

    // Helper: Base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Helper: Format PEM string
    formatPEM(str) {
        const lines = [];
        for (let i = 0; i < str.length; i += 64) {
            lines.push(str.substring(i, Math.min(i + 64, str.length)));
        }
        return lines.join('\n');
    }
}
