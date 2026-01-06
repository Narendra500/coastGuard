package main

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"os"
	"time"

	"social-ingestion/internal/hazard"
	"social-ingestion/internal/rabbit"
	"social-ingestion/internal/redis"
	"social-ingestion/internal/sources"
)

func hashKey(source, id string) string {
	h := sha256.Sum256([]byte(source + id))
	return hex.EncodeToString(h[:])
}

type User struct {
	name string
}

type Extra struct {
	hazard_type string
}

func run() {
	log.Println("[START] Social ingestion run started")

	rmq := rabbit.New(os.Getenv("RABBITMQ_URL"))
	store := redis.New(os.Getenv("REDIS_URL"))

	process := func(source string, posts []sources.Post) {
		log.Printf("[SOURCE] %s fetched %d posts\n", source, len(posts))

		for _, p := range posts {
			log.Printf("[POST] %s | %s\n", source, p.ID)

			hazards := hazard.Detect(p.Text)
			if len(hazards) == 0 {
				log.Printf("[SKIP] No hazards detected (%s)\n", p.ID)
				continue
			}

			key := hashKey(source, p.ID)
			if store.Exists(key) {
				log.Printf("[DEDUP] Already processed (%s)\n", p.ID)
				continue
			}

			msg := map[string]any{
				"type":       "social-media-post",
				"skip":       false,
				"platform":   source,
				"post_id":    p.ID,
				"user":       User{p.Author},
				"text":       p.Text,
				"created_at": p.Timestamp,
				"extra":      Extra{hazards[0]},
				"raw_url":    p.URL,
			}

			if err := rmq.Publish(msg); err != nil {
				log.Printf("[ERROR] RabbitMQ publish failed (%s): %v\n", p.ID, err)
				continue
			}

			store.Mark(key)
			log.Printf("[PUBLISHED] %s (%v)\n", p.ID, hazards)
		}
	}

	process("telegram", sources.FetchTelegram())
	process("bluesky", sources.FetchBluesky())

	log.Println("[END] Social ingestion run finished")
}

func main() {
	log.Println("[BOOT] Social ingestion service started")

	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	run()

	for range ticker.C {
		run()
	}
}
