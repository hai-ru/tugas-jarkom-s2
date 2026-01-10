package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/hai-ru/tugas-jarkom-s2/server"
)

func main() {
	port := flag.String("port", "8080", "Server port")
	flag.Parse()

	hub := server.NewHub()
	go hub.Run()

	// WebSocket endpoint
	http.HandleFunc("/ws", hub.HandleWebSocket)

	// Serve static files
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	addr := fmt.Sprintf(":%s", *port)
	log.Printf("Server starting on %s", addr)
	log.Printf("Open http://localhost%s in your browser", addr)
	
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("ListenAndServe error:", err)
	}
}
