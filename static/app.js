// Main Application Logic

const cryptoLib = new CryptoLib();
let ws = null;
let currentUser = null;
let selectedUser = null;
let users = {};
let sessionKeys = {}; // Store AES keys for each user session

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('usernameInput');
const connectBtn = document.getElementById('connectBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesDiv = document.getElementById('messages');
const userListDiv = document.getElementById('userList');
const statusSpan = document.getElementById('status');
const usernameDisplay = document.getElementById('username-display');
const chatTitle = document.getElementById('chatTitle');
const encryptionStatus = document.getElementById('encryptionStatus');
const publicKeyDisplay = document.getElementById('publicKeyDisplay');

// Event Listeners
connectBtn.addEventListener('click', connect);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        sendMessage();
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && usernameInput.value.trim()) {
        connect();
    }
});

async function connect() {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
        // Generate RSA key pair
        await cryptoLib.generateRSAKeyPair();
        const publicKeyPEM = await cryptoLib.exportPublicKey();
        publicKeyDisplay.value = publicKeyPEM;

        // Connect to WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            currentUser = {
                id: generateId(),
                username: username,
                publicKey: publicKeyPEM
            };

            // Register with server
            ws.send(JSON.stringify({
                type: 'register',
                from: currentUser.id,
                content: username,
                publicKey: publicKeyPEM
            }));
        };

        ws.onmessage = handleMessage;

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus(false);
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect';
        };

        ws.onclose = () => {
            updateStatus(false);
            addSystemMessage('Disconnected from server');
        };

    } catch (error) {
        console.error('Connection error:', error);
        alert('Failed to connect: ' + error.message);
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    }
}

async function handleMessage(event) {
    try {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'welcome':
                updateStatus(true);
                loginScreen.style.display = 'none';
                chatScreen.style.display = 'flex';
                usernameDisplay.textContent = currentUser.username;
                addSystemMessage('Connected successfully! Your messages are encrypted end-to-end.');
                break;

            case 'userList':
                updateUserList(data.users);
                break;

            case 'chat':
                await receiveEncryptedMessage(data);
                break;

            case 'keyExchange':
                await handleKeyExchange(data);
                break;
        }
    } catch (error) {
        console.error('Message handling error:', error);
    }
}

function updateUserList(userList) {
    users = {};
    userListDiv.innerHTML = '';

    userList.forEach(user => {
        users[user.id] = user;

        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        if (user.id === currentUser.id) {
            userItem.classList.add('self');
        } else {
            userItem.addEventListener('click', () => selectUser(user));
        }

        if (selectedUser && user.id === selectedUser.id) {
            userItem.classList.add('active');
        }

        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = user.username.charAt(0).toUpperCase();

        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';

        const userName = document.createElement('div');
        userName.className = 'user-name';
        userName.textContent = user.username;

        const userStatus = document.createElement('div');
        userStatus.className = 'user-status';
        userStatus.textContent = user.id === currentUser.id ? '(You)' : 'Online';

        userInfo.appendChild(userName);
        userInfo.appendChild(userStatus);
        userItem.appendChild(avatar);
        userItem.appendChild(userInfo);
        userListDiv.appendChild(userItem);
    });
}

async function selectUser(user) {
    selectedUser = user;
    chatTitle.textContent = `Chat with ${user.username}`;
    encryptionStatus.innerHTML = '<span class="encryption-badge">🔒 End-to-End Encrypted</span>';
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();

    // Update active state
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.user-item').classList.add('active');

    // Generate session key if not exists
    if (!sessionKeys[user.id]) {
        sessionKeys[user.id] = await cryptoLib.generateAESKey();
        
        // Send encrypted AES key to the user
        try {
            const recipientPublicKey = await cryptoLib.importPublicKey(user.publicKey);
            const encryptedKey = await cryptoLib.encryptAESKey(sessionKeys[user.id], recipientPublicKey);
            
            ws.send(JSON.stringify({
                type: 'keyExchange',
                from: currentUser.id,
                to: user.id,
                content: encryptedKey
            }));
        } catch (error) {
            console.error('Key exchange error:', error);
        }
    }
}

async function handleKeyExchange(data) {
    try {
        // Decrypt the AES key with our private key
        const aesKey = await cryptoLib.decryptAESKey(data.content);
        sessionKeys[data.from] = aesKey;
        console.log('Session key established with', users[data.from]?.username);
    } catch (error) {
        console.error('Key exchange handling error:', error);
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !selectedUser) return;

    try {
        // Ensure we have a session key
        if (!sessionKeys[selectedUser.id]) {
            alert('Establishing encryption... Please try again in a moment.');
            return;
        }

        // Encrypt the message
        const encryptedMessage = await cryptoLib.encryptMessage(message, sessionKeys[selectedUser.id]);

        // Send to server
        ws.send(JSON.stringify({
            type: 'chat',
            from: currentUser.id,
            to: selectedUser.id,
            content: encryptedMessage,
            timestamp: new Date().toISOString()
        }));

        // Display in our chat
        addMessage(currentUser.username, message, true);
        messageInput.value = '';

    } catch (error) {
        console.error('Send message error:', error);
        alert('Failed to send message: ' + error.message);
    }
}

async function receiveEncryptedMessage(data) {
    try {
        // Decrypt the message
        if (!sessionKeys[data.from]) {
            console.error('No session key for sender:', data.from);
            return;
        }

        const decryptedMessage = await cryptoLib.decryptMessage(data.content, sessionKeys[data.from]);
        const sender = users[data.from];
        
        if (sender) {
            addMessage(sender.username, decryptedMessage, false);
        }
    } catch (error) {
        console.error('Receive message error:', error);
        addMessage('System', 'Failed to decrypt message', false);
    }
}

function addMessage(username, content, sent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sent ? 'sent' : 'received'}`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = username;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = content;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateStatus(connected) {
    if (connected) {
        statusSpan.textContent = 'Connected';
        statusSpan.className = 'status-connected';
    } else {
        statusSpan.textContent = 'Disconnected';
        statusSpan.className = 'status-disconnected';
    }
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
