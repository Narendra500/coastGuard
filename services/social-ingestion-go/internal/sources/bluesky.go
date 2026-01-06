package sources

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"
)

const blueskyBase = "https://bsky.social/xrpc"

type sessionResp struct {
	AccessJwt string `json:"accessJwt"`
}

type searchResp struct {
	Posts []struct {
		URI    string `json:"uri"`
		Author struct {
			Handle string `json:"handle"`
		} `json:"author"`
		Record struct {
			Text      string `json:"text"`
			CreatedAt string `json:"createdAt"`
		} `json:"record"`
	} `json:"posts"`
}

func createSession() string {
	payload := map[string]string{
		"identifier": os.Getenv("BLUESKY_HANDLE"),
		"password":   os.Getenv("BLUESKY_PASSWORD"),
	}

	b, _ := json.Marshal(payload)
	resp, err := http.Post(
		blueskyBase+"/com.atproto.server.createSession",
		"application/json",
		bytes.NewBuffer(b),
	)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var s sessionResp
	json.NewDecoder(resp.Body).Decode(&s)
	return s.AccessJwt
}

func FetchBluesky() []Post {
	log.Println("[BLUESKY] Starting keyword search")

	token := createSession()
	if token == "" {
		log.Println("[BLUESKY] Session creation failed")
		return nil
	}

	queries := []string{
		"tsunami india",
		"high wave india",
		"storm surge india",
		"coastal flooding india",
	}

	client := &http.Client{Timeout: 10 * time.Second}
	var results []Post

	for _, q := range queries {
		log.Printf("[BLUESKY] Searching: %s\n", q)

		endpoint := blueskyBase + "/app.bsky.feed.searchPosts?q=" +
			url.QueryEscape(q) + "&limit=25"

		req, _ := http.NewRequest("GET", endpoint, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[BLUESKY] Search failed (%s): %v\n", q, err)
			continue
		}

		var data searchResp
		json.NewDecoder(resp.Body).Decode(&data)
		resp.Body.Close()

		log.Printf("[BLUESKY] %d posts found for '%s'\n", len(data.Posts), q)

		for _, p := range data.Posts {
			results = append(results, Post{
				ID:        p.URI,
				Author:    p.Author.Handle,
				Text:      p.Record.Text,
				URL:       "https://bsky.app/profile/" + p.Author.Handle,
				Timestamp: p.Record.CreatedAt,
			})
		}
	}

	return results
}
