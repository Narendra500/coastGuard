package rabbit

import (
	"encoding/json"
	"log"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Publisher struct {
	ch *amqp.Channel
}

func New(url string) *Publisher {
	log.Println("[RABBIT] Connecting to RabbitMQ")

	conn, err := amqp.Dial(url)
	if err != nil {
		log.Fatal("[RABBIT] Connection failed:", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		log.Fatal("[RABBIT] Channel creation failed:", err)
	}

	_, err = ch.QueueDeclare(
		"reports",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatal("[RABBIT] Queue declare failed:", err)
	}

	log.Println("[RABBIT] Connected and queue ready")
	return &Publisher{ch: ch}
}

func (p *Publisher) Publish(msg any) error {
	body, _ := json.Marshal(msg)
	log.Println("[RABBIT] Publishing message to reports queue")

	return p.ch.Publish(
		"",
		"reports",
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		},
	)
}
