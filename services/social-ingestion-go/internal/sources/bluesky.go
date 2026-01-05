package sources

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

const blueskyBase = "https://bsky.social/xrpc"

type sessionResp struct {
	AccessJwt string `json:"accessJwt"`
	DID       string `json:"did"`
}

type timelineResp struct {
	Feed []struct {
		Post struct {
			URI    string `json:"uri"`
			Record struct {
				Text      string `json:"text"`
				CreatedAt string `json:"createdAt"`
			} `json:"record"`
			Author struct {
				Handle string `json:"handle"`
			} `json:"author"`
		} `json:"post"`
	} `json:"feed"`
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
	token := createSession()
	if token == "" {
		return nil
	}

	req, _ := http.NewRequest(
		"GET",
		blueskyBase+"/app.bsky.feed.getTimeline?limit=5",
		nil,
	)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var data timelineResp
	json.NewDecoder(resp.Body).Decode(&data)

	var posts []Post

	for _, item := range data.Feed {
		p := item.Post
		posts = append(posts, Post{
			ID:        p.URI,
			Author:    p.Author.Handle,
			Text:      p.Record.Text,
			URL:       "https://bsky.app/profile/" + p.Author.Handle,
			Timestamp: p.Record.CreatedAt,
		})
	}

	return posts
}
