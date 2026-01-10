# Aplikasi Chat End-to-End Encryption

Aplikasi chat real-time dengan enkripsi end-to-end (E2E) menggunakan Go dan WebSocket. Pesan-pesan dienkripsi menggunakan kombinasi RSA-OAEP (untuk pertukaran kunci) dan AES-256-GCM (untuk enkripsi pesan).

## Fitur

✅ **End-to-End Encryption**: Semua pesan dienkripsi di client sebelum dikirim
✅ **RSA-OAEP 2048-bit**: Untuk pertukaran kunci AES yang aman
✅ **AES-256-GCM**: Untuk enkripsi pesan dengan authenticated encryption
✅ **WebSocket**: Komunikasi real-time yang efisien
✅ **Web UI**: Interface yang modern dan responsive
✅ **Multi-User**: Mendukung banyak pengguna secara bersamaan
✅ **Visual Indikator**: Status enkripsi dan koneksi yang jelas

## Arsitektur Keamanan

1. **Key Generation**: Setiap client menghasilkan pasangan kunci RSA 2048-bit saat connect
2. **Key Exchange**: Client bertukar kunci public melalui server
3. **Session Key**: Untuk setiap sesi chat, dibuat kunci AES-256 yang unik
4. **Message Encryption**: Pesan dienkripsi dengan AES-256-GCM sebelum dikirim
5. **Server Role**: Server hanya meneruskan pesan terenkripsi, tidak bisa membaca isi

## Teknologi

- **Backend**: Go 1.24+
- **WebSocket**: Gorilla WebSocket
- **Crypto**: 
  - Go `crypto` package (RSA, AES, SHA-256)
  - Web Crypto API (client-side)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)

## Struktur Proyek

```
tugas-jarkom-s2/
├── main.go                 # Entry point server
├── crypto/
│   └── encryption.go       # Fungsi enkripsi/dekripsi (Go)
├── server/
│   └── hub.go             # WebSocket hub & message routing
├── static/
│   ├── index.html         # UI aplikasi
│   ├── style.css          # Styling
│   ├── crypto-lib.js      # Client-side crypto library
│   └── app.js             # Client-side application logic
├── go.mod                 # Go module dependencies
└── README.md              # Dokumentasi ini
```

## Instalasi

1. **Clone repository**:
```bash
git clone https://github.com/hai-ru/tugas-jarkom-s2.git
cd tugas-jarkom-s2
```

2. **Install dependencies**:
```bash
go mod download
```

3. **Build aplikasi** (opsional):
```bash
go build -o chat-server
```

## Cara Menjalankan

### Opsi 1: Menggunakan `go run`

```bash
go run main.go
```

### Opsi 2: Menggunakan binary yang sudah di-build

```bash
./chat-server
```

### Opsi 3: Dengan custom port

```bash
go run main.go -port 9090
```

Server akan berjalan di `http://localhost:8080` (atau port yang Anda tentukan).

## Cara Menggunakan

1. **Buka browser** dan akses `http://localhost:8080`

2. **Masukkan username** Anda dan klik "Connect"

3. **Buka tab/window browser baru** dengan URL yang sama untuk simulasi user kedua

4. **Masukkan username berbeda** untuk user kedua

5. **Pilih user** dari sidebar untuk memulai chat

6. **Kirim pesan** - semua pesan akan dienkripsi secara otomatis!

## Testing

### Test dengan Multiple Users

1. Buka 3-4 tab browser berbeda
2. Login dengan username berbeda di setiap tab:
   - User: Alice
   - User: Bob
   - User: Charlie
3. Pilih user untuk chat dan kirim pesan
4. Verifikasi bahwa:
   - Pesan hanya terbaca oleh pengirim dan penerima
   - Server tidak bisa membaca pesan (cek server log)
   - Status "End-to-End Encrypted" muncul

### Verifikasi Enkripsi

1. Buka Developer Tools (F12)
2. Pergi ke tab Network > WS (WebSocket)
3. Pilih koneksi WebSocket
4. Lihat messages yang dikirim - semuanya dalam bentuk encrypted (base64)
5. Verifikasi bahwa plaintext tidak pernah dikirim

### Test Keamanan

```bash
# Monitor traffic dengan tcpdump (Linux/Mac)
sudo tcpdump -i lo -A port 8080

# Atau gunakan Wireshark untuk inspect packets
# Verifikasi bahwa message content adalah encrypted
```

## Alur Kerja Enkripsi

### 1. Koneksi & Key Generation
```
Client → Generate RSA Key Pair (2048-bit)
Client → Connect to Server via WebSocket
Client → Send Public Key to Server
```

### 2. Key Exchange (saat memilih user untuk chat)
```
Client A → Generate AES-256 Key
Client A → Encrypt AES Key dengan Public Key Client B (RSA-OAEP)
Client A → Send Encrypted Key ke Client B via Server
Client B → Decrypt AES Key dengan Private Key (RSA-OAEP)
```

### 3. Message Encryption & Sending
```
Client A → Encrypt Message dengan AES-256-GCM
Client A → Send Encrypted Message via WebSocket
Server  → Forward ke Client B (tidak bisa decrypt)
Client B → Decrypt Message dengan AES-256-GCM
Client B → Display Plain Text Message
```

## API WebSocket

### Client → Server Messages

**Register (saat connect)**:
```json
{
  "type": "register",
  "from": "client-id",
  "content": "username",
  "publicKey": "-----BEGIN PUBLIC KEY-----..."
}
```

**Key Exchange**:
```json
{
  "type": "keyExchange",
  "from": "sender-id",
  "to": "recipient-id",
  "content": "encrypted-aes-key-base64"
}
```

**Chat Message**:
```json
{
  "type": "chat",
  "from": "sender-id",
  "to": "recipient-id",
  "content": "encrypted-message-base64",
  "timestamp": "2026-01-10T05:55:54.836Z"
}
```

### Server → Client Messages

**Welcome (setelah registrasi)**:
```json
{
  "type": "welcome",
  "content": "Connected to server",
  "publicKey": "server-public-key"
}
```

**User List Update**:
```json
{
  "type": "userList",
  "users": [
    {
      "id": "user-id",
      "username": "Alice",
      "publicKey": "-----BEGIN PUBLIC KEY-----..."
    }
  ]
}
```

## Troubleshooting

### Port sudah digunakan
```bash
# Gunakan port lain
go run main.go -port 9090
```

### Browser tidak support Web Crypto API
- Gunakan browser modern: Chrome, Firefox, Safari, Edge
- Pastikan mengakses via `localhost` atau `https://`

### Pesan tidak bisa decrypt
- Pastikan key exchange berhasil (cek console log)
- Refresh kedua client dan coba lagi
- Cek apakah ada error di browser console

## Keamanan

⚠️ **Catatan Penting untuk Production**:

1. **HTTPS**: Selalu gunakan HTTPS di production
2. **Certificate Pinning**: Implementasi untuk mencegah MITM
3. **Rate Limiting**: Tambahkan untuk mencegah spam/DoS
4. **Authentication**: Tambahkan sistem autentikasi yang proper
5. **Key Rotation**: Implementasi periodic key rotation
6. **Perfect Forward Secrecy**: Pertimbangkan menggunakan Diffie-Hellman

## Lisensi

MIT License - bebas digunakan untuk keperluan pendidikan dan non-komersial.

## Kontributor

- Developed for Tugas Jaringan Komputer S2

## Screenshots

![Chat Interface](docs/screenshot.png) _(akan ditambahkan setelah testing)_

---

**Happy Secure Chatting! 🔒**