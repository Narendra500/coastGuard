package redis

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type Store struct {
	rdb *redis.Client
	ctx context.Context
}

func New(url string) *Store {
	log.Println("[REDIS] Connecting to Redis")

	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Fatal("[REDIS] Invalid Redis URL:", err)
	}

	return &Store{
		rdb: redis.NewClient(opt),
		ctx: context.Background(),
	}
}

func (s *Store) Exists(key string) bool {
	n, err := s.rdb.Exists(s.ctx, key).Result()
	if err != nil {
		log.Printf("[REDIS] Exists check error (%s): %v\n", key, err)
		return false
	}
	return n == 1
}

func (s *Store) Mark(key string) {
	err := s.rdb.Set(s.ctx, key, "1", 30*24*time.Hour).Err()
	if err != nil {
		log.Printf("[REDIS] Failed to mark key (%s): %v\n", key, err)
	} else {
		log.Printf("[REDIS] Marked processed (%s)\n", key)
	}
}
