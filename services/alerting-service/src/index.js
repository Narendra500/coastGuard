import amqplib from "amqplib";
import { config } from "./config.js";
import { findUsersNearby } from "./db.js"; // Updated import
import {
  sendEmail,
  sendSms,
  emailSubjectFor,
  emailBodyFor,
  smsBodyFor,
} from "./notifier.js";

(async () => {
  console.log("Starting Geo-Notification Engine...");

  const conn = await amqplib.connect(config.rabbit.url);
  const ch = await conn.createChannel();

  await ch.assertQueue(config.rabbit.queue, { durable: true });
  ch.prefetch(5);

  ch.consume(
    config.rabbit.queue,
    async (msg) => {
      if (!msg) return;

      try {
        const raw = msg.content.toString();
        const alert = JSON.parse(raw);

        // Basic Validation
        if (!alert || !alert.location || !alert.priority) {
          console.warn("Invalid alert, dropping:", raw);
          ch.nack(msg, false, false);
          return;
        }

        // 1. Determine Target Audience based on Alert Type
        let targetRoles = ["official"]; // Default to officials only
        let radius = config.radiusKm;

        if (alert.type === "RED_ALERT") {
          targetRoles = null; // Broadcast to EVERYONE
          radius = alert.radius || 50; // Red Alerts might have custom large radius
        } else if (alert.type === "CITIZEN_WARNING") {
          targetRoles = ["citizen", "official"]; // Warn people and officials
          radius = 10; // Smaller radius for specific hazards
        }

        console.log(
          `Processing ${alert.type || "Standard"} Alert for: ${targetRoles || "EVERYONE"}`,
        );

        // 2. Find Users
        const users = await findUsersNearby(
          alert.location.lat,
          alert.location.long,
          radius,
          targetRoles,
        );

        console.log(`Found ${users.length} users within ${radius} km`);

        // 3. Prepare Content
        const emailSubject = emailSubjectFor(alert);
        const emailBody = emailBodyFor(alert);
        const smsBody = smsBodyFor(alert);

        const isEmergency =
          alert.priority === "high" || alert.priority === "critical";

        // 4. Send Notifications
        for (const u of users) {
          try {
            // Email (All users)
            if (u.email) {
              await sendEmail(u.email, emailSubject, emailBody);
            }

            // SMS (Only for Emergencies or Officials)
            // "Red Alert" implies critical urgency
            if ((isEmergency || u.role_name === "official") && u.phone) {
              await sendSms(u.phone, smsBody);
            }
          } catch (err) {
            console.error(`Failed to notify user ${u.user_id}:`, err);
          }
        }

        ch.ack(msg);
      } catch (err) {
        console.error("Error processing alert:", err);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false },
  );
})();
