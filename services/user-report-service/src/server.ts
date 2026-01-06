import express from "express";
import { connectRabbitMQ } from "./rabbitmq.js";
import authMiddleware from "./middlewares/auth.middleware.js";
import { broadcastRedAlertHandler, debunkReport, updateUserLocation, verifyReport } from "./controllers/report.controller.js";

// handle global exceptions early
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});

async function bootstrap() {
    try {
        // dynamic import of controllers
        const controller = await import("./controllers/report.controller.js");
        const createReportHandler = controller.createReportHandler;
        const getReportsHandler = controller.getReportsHandler;
        const getMyReportsHandler = controller.getMyReportsHandler;

        // connect to RabbitMQ
        await connectRabbitMQ();

        const app = express();
        app.use(express.json());

        // routes
        app.post("/api/v1/reports", authMiddleware, createReportHandler);
        app.post("/api/v1/alerts/broadcast", authMiddleware, broadcastRedAlertHandler);
        app.post("/api/v1/users/update-location", authMiddleware, updateUserLocation);
        app.patch("/api/v1/reports/verify-user-report/:report_id", authMiddleware, verifyReport);
        app.patch("/api/v1/reports/debunk-user-report/:report_id", authMiddleware, debunkReport);
        app.get("/api/v1/reports", authMiddleware, getReportsHandler);
        app.get("/api/v1/reports/mine", authMiddleware, getMyReportsHandler);

        const PORT = Number(process.env.PORT) || 3005;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[INFO] user-report-service listening on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

// start everything
bootstrap();
