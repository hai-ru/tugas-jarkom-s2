package server

import (
	"crypto/rsa"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/hai-ru/tugas-jarkom-s2/crypto"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for testing
	},
}

// Client represents a connected user
type Client struct {
	ID         string
	Username   string
	Conn       *websocket.Conn
	PublicKey  string
	PrivateKey *rsa.PrivateKey
	Hub        *Hub
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[string]*Client
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

// Message represents a chat message
type Message struct {
	Type      string `json:"type"`
	From      string `json:"from"`
	To        string `json:"to"`
	Content   string `json:"content"`
	PublicKey string `json:"publicKey,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan *Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client.ID] = client
			h.mutex.Unlock()
			log.Printf("Client registered: %s (%s)", client.Username, client.ID)

			// Broadcast user list update
			h.broadcastUserList()

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				client.Conn.Close()
				log.Printf("Client unregistered: %s (%s)", client.Username, client.ID)
			}
			h.mutex.Unlock()

			// Broadcast user list update
			h.broadcastUserList()

		case message := <-h.broadcast:
			h.handleMessage(message)
		}
	}
}

func (h *Hub) handleMessage(msg *Message) {
	switch msg.Type {
	case "chat", "keyExchange":
		// Send message to specific recipient
		h.mutex.RLock()
		recipient, ok := h.clients[msg.To]
		h.mutex.RUnlock()

		if ok {
			data, _ := json.Marshal(msg)
			recipient.Conn.WriteMessage(websocket.TextMessage, data)
		}

	case "broadcast":
		// Broadcast to all clients except sender
		h.mutex.RLock()
		for id, client := range h.clients {
			if id != msg.From {
				data, _ := json.Marshal(msg)
				client.Conn.WriteMessage(websocket.TextMessage, data)
			}
		}
		h.mutex.RUnlock()
	}
}

func (h *Hub) broadcastUserList() {
	h.mutex.RLock()
	users := make([]map[string]string, 0)
	for _, client := range h.clients {
		users = append(users, map[string]string{
			"id":        client.ID,
			"username":  client.Username,
			"publicKey": client.PublicKey,
		})
	}
	h.mutex.RUnlock()

	data, _ := json.Marshal(map[string]interface{}{
		"type":  "userList",
		"users": users,
	})

	h.mutex.RLock()
	for _, client := range h.clients {
		client.Conn.WriteMessage(websocket.TextMessage, data)
	}
	h.mutex.RUnlock()
}

// HandleWebSocket handles WebSocket connections
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	// Generate RSA key pair for this client
	privateKey, err := crypto.GenerateRSAKeyPair()
	if err != nil {
		log.Println("Key generation error:", err)
		conn.Close()
		return
	}

	publicKeyStr, err := crypto.PublicKeyToString(&privateKey.PublicKey)
	if err != nil {
		log.Println("Public key conversion error:", err)
		conn.Close()
		return
	}

	client := &Client{
		Conn:       conn,
		Hub:        h,
		PrivateKey: privateKey,
		PublicKey:  publicKeyStr,
	}

	// Read the initial registration message
	_, message, err := conn.ReadMessage()
	if err != nil {
		log.Println("Read error:", err)
		conn.Close()
		return
	}

	var regMsg Message
	if err := json.Unmarshal(message, &regMsg); err != nil {
		log.Println("Unmarshal error:", err)
		conn.Close()
		return
	}

	if regMsg.Type == "register" {
		client.ID = regMsg.From
		client.Username = regMsg.Content
		client.PublicKey = regMsg.PublicKey

		// Send server's public key to client
		welcome := Message{
			Type:      "welcome",
			Content:   "Connected to server",
			PublicKey: publicKeyStr,
		}
		data, _ := json.Marshal(welcome)
		conn.WriteMessage(websocket.TextMessage, data)

		// Register the client
		h.register <- client

		// Start reading messages from this client
		go h.readMessages(client)
	} else {
		conn.Close()
	}
}

func (h *Hub) readMessages(client *Client) {
	defer func() {
		h.unregister <- client
	}()

	for {
		_, message, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Println("Unmarshal error:", err)
			continue
		}

		// Forward the message through the hub
		h.broadcast <- &msg
	}
}
