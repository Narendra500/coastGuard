import dotenv from "dotenv";
dotenv.config();

export const config = {
  rabbit: {
    url: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
    queue: process.env.RABBITMQ_QUEUE || "alerts",
  },
  pg: {
    connectionString:
      process.env.PG_CONNECTION ||
      "postgresql://postgres:naku@postgres:5432/coast_guard?schema=public",
  },
  radiusKm: Number(process.env.RADIUS_KM || "50"), // default 50 km
  email: {
    smtpUser: process.env.EMAIL_ADDRESS,
    smtpPass: process.env.APP_PASSWORD,
    from: process.env.EMAIL_ADDRESS,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM,
  },
  env: process.env.NODE_ENV || "development",
};
