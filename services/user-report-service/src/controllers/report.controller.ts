import type { Request, Response } from "express";
import { pool } from "../db.js";
import { publishUserReport } from "../rabbitmq.js";
import { apiResponse } from "../utils/api.response.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/api.error.js";
import { HTTP_RESPONSE_CODE } from "../constants/api.response.codes.js";
import crypto from "crypto"

// POST /reports
export async function createReportHandler(req: any, res: Response) {
    const user_id = req.userId;
    const user_name = req.userName;
    const skip = req.body.skip || false;
    const text = req.body.text || null;
    const report_type = req.body.type;
    const lat = Number(req.body.latitude);
    const lon = Number(req.body.longitude);
    const reported_at = req.body.timestamp;
    const incomingMediaUrl = req.body.mediaUrl;
    let priority = "low";

    if (report_type === "tsunami" || report_type === "oil-spill")
        priority = "high";
    else if (report_type === "flood")
        priority = "medium"

    if (!text && !incomingMediaUrl) {
        throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "Either 'text' or 'media' must be provided");
    }
    if (isNaN(lat) || isNaN(lon)) {
        throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "latitude and longitude are required");
    }

    const client = await pool.connect();
    try {
        const location_name = req.body.location_name || null;

        let mediaUrls: string[] = [];
        if (incomingMediaUrl) {
            mediaUrls.push(incomingMediaUrl);
        }

        const messageId = crypto.randomUUID();
        const message = {
            id: messageId,
            skip: skip,
            user: { id: user_id, name: user_name, username: user_name },
            type: "user-post",
            text,
            location: { lat, lon, name: location_name },
            media: mediaUrls,
            platform: "coast_guard",
            created_at: Date.now(),
            extra: { alert_level: priority, hazard_type: report_type }
        };
        await publishUserReport(message);

        return res.status(201).json(apiResponse(true, "Report submitted", { messageId, media: mediaUrls }));
    } catch (err) {
        await client.query("ROLLBACK");
        logger.error("Error creating report", { err });
        throw err;
    } finally {
        client.release();
    }
}

// GET /reports
export async function getReportsHandler(req: Request, res: Response) {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lon = req.query.lon ? Number(req.query.lon) : null;
    const radius_km = req.query.radius_km ? Number(req.query.radius_km) : null;
    /*
        status:
        1: not_verified
        2: official_verfied
        3: community_verified
    */
    let status = req.query.status ? String(req.query.status) : true;
    /*
        types_ids: 
        1:  tsunami
        2:  high-wave
        3:  oil-spill
        4:  flooding 
    */
    const type_id = req.query.type_id ? Number(req.query.type_id) : null;

    let limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 50;

    const params: any[] = [];
    let whereClauses: string[] = ["is_deleted = false"];
    // if (!isNaN(Number(type_id))) {
    //     params.push(type_id);
    //     whereClauses.push(`hazard_type_id = $${params.length}`);
    // }

    if (typeof status === "string") {
        params.push(`%${status}%`);
        whereClauses.push(`status_name ILIKE $${params.length}`);
    }

    let radiusClause = "";
    if (!isNaN(Number(lat)) && !isNaN(Number(lon)) && !isNaN(Number(radius_km))) {
        params.push(Number(lon || 0), Number(lat || 0), Number(radius_km || 0) * 1000);

        const idx = params.length - 2;
        radiusClause = `AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($${idx}, $${idx + 1}),4326)::geography, $${idx + 2})`;
    }
    const whereStatus = "status_name ILIKE $1"

    const baseQuery = `
    SELECT
      hazard_reports.*,
      hazard_types.type_name,
      users.user_name,
      report_statuses.status_name,
      COALESCE(array_agg(report_media.media_url) FILTER (WHERE report_media.media_url IS NOT NULL), '{}') as media_urls
    FROM hazard_reports 
    LEFT JOIN hazard_types ON hazard_reports.hazard_type_id = hazard_types.type_id
    LEFT JOIN report_statuses ON hazard_reports.status_id = report_statuses.status_id
    LEFT JOIN report_media ON hazard_reports.media_id = report_media.media_id
    LEFT JOIN users ON hazard_reports.user_id = users.user_id
    WHERE ${typeof status === "string" ? whereStatus : '$1'}
    GROUP BY hazard_reports.report_id, hazard_types.type_name, report_statuses.status_name, users.user_name
    ORDER BY hazard_reports.report_time DESC
  `;
    params.push(limit);
    const { rows } = await pool.query(baseQuery, [status]);
    return res.json(apiResponse(true, "Reports fetched", rows));
}

// GET /reports/mine
export async function getMyReportsHandler(req: any, res: Response) {
    const user_id = req.userId;
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lon = req.query.lon ? Number(req.query.lon) : null;
    const radius_km = req.query.radius_km ? Number(req.query.radius_km) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const type_id = req.query.type_id ? Number(req.query.type_id) : null;
    let limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 50;

    const params: any[] = [user_id];
    let whereClauses: string[] = ["hazard_reports.is_deleted = false", `hazard_reports.user_id = $1`];

    if (!isNaN(Number(type_id))) {
        params.push(type_id);
        whereClauses.push(`hazard_reports.hazard_type_id = $${params.length}`);
    }
    if (status) {
        if (!isNaN(Number(status))) {
            params.push(Number(status));
            whereClauses.push(`hazard_reports.status_id = $${params.length}`);
        } else {
            params.push(`%${status}%`);
            whereClauses.push(`report_statuses.status_name ILIKE $${params.length}`);
        }
    }

    let radiusClause = "";
    if (!isNaN(Number(lat)) && !isNaN(Number(lon)) && !isNaN(Number(radius_km))) {
        params.push(Number(lon || 0), Number(lat || 0), Number(radius_km || 0) * 1000);

        const idx = params.length - 2;
        radiusClause = `AND ST_DWithin(hazard_reports.location::geography, ST_SetSRID(ST_MakePoint($${idx}, $${idx + 1}),4326)::geography, $${idx + 2})`;
    }

    const baseQuery = `
    SELECT
      hazard_reports.*,
      hazard_types.type_name,
      users.user_name,
      report_statuses.status_name,
      COALESCE(array_agg(report_media.media_url) FILTER (WHERE report_media.media_url IS NOT NULL), '{}') as media_urls
    FROM hazard_reports 
    LEFT JOIN hazard_types ON hazard_reports.hazard_type_id = hazard_types.type_id
    LEFT JOIN report_statuses ON hazard_reports.status_id = report_statuses.status_id
    LEFT JOIN report_media ON hazard_reports.media_id = report_media.media_id
    LEFT JOIN users ON hazard_reports.user_id = users.user_id
    GROUP BY hazard_reports.report_id, hazard_types.type_name, report_statuses.status_name, users.user_name
    ORDER BY hazard_reports.report_time DESC
  `;
    params.push(limit);
    const { rows } = await pool.query(baseQuery, params);
    return res.json(apiResponse(true, "User reports fetched", rows));
}

export async function verifyReport(req: any, res: any) {
    const userID = req.userId;
    const userRole = req.role;
    const reportID = req.params.report_id;
    console.log("VERIFICATION ROUTE HIT")

    if (!userID || !userRole)
        throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "userID and userRole required for report verification");

    console.log("DOES HAVE ID AND ROLE")

    if (userRole != "official")
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Only officials permitted to verify reports");

    console.log("IS OFFICIAL")

    const query = `
        UPDATE hazard_reports
        SET verified_by = $1, status_id = 2
        WHERE report_id = $2
    `

    await pool.query(query, [userID, reportID]);

    res.status(HTTP_RESPONSE_CODE.SUCCESS).json(apiResponse(true, "report verified successfully"))
}

export async function debunkReport(req: any, res: any) {
    const userID = req.userId;
    const userRole = req.role;
    const reportID = req.params.report_id;
    console.log("debunk route HIT, reportID", reportID)

    if (!userID || !userRole)
        throw new ApiError(HTTP_RESPONSE_CODE.BAD_REQUEST, "userID and userRole required for report verification");
    console.log("HAS ID AND ROLE")

    if (userRole != "official")
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Only officials permitted to verify reports");
    console.log("IS OFFICIAL")

    const query = `
        UPDATE hazard_reports
        SET verified_by = $1, status_id = 4
        WHERE report_id = $2
        RETURNING status_id
    `

    const result = await pool.query(query, [userID, reportID]);
    console.log(result)

    res.status(HTTP_RESPONSE_CODE.SUCCESS).json(apiResponse(true, "report debunked successfully"))
}
