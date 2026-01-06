package sources

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type tgUpdateResponse struct {
	Result []struct {
		ChannelPost struct {
			MessageID int    `json:"message_id"`
			Text      string `json:"text"`
			Date      int64  `json:"date"`
			Chat      struct {
				Username string `json:"username"`
			} `json:"chat"`
		} `json:"channel_post"`
	} `json:"result"`
}

func FetchTelegram() []Post {
	log.Println("[TELEGRAM] Fetching updates")

	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getUpdates", token)

	resp, err := http.Get(url)
	if err != nil {
		log.Println("[TELEGRAM] HTTP error:", err)
		return nil
	}
	defer resp.Body.Close()

	var data tgUpdateResponse
	json.NewDecoder(resp.Body).Decode(&data)

	log.Printf("[TELEGRAM] Received %d updates\n", len(data.Result))

	var posts []Post
	for _, upd := range data.Result {
		cp := upd.ChannelPost
		if cp.Text == "" {
			continue
		}

		posts = append(posts, Post{
			ID:        fmt.Sprintf("tg-%d", cp.MessageID),
			Author:    cp.Chat.Username,
			Text:      cp.Text,
			URL:       fmt.Sprintf("https://t.me/%s/%d", cp.Chat.Username, cp.MessageID),
			Timestamp: time.Unix(cp.Date, 0).UTC().Format(time.RFC3339),
		})
	}

	return posts
}
