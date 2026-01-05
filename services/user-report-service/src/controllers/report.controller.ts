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


export async function getReportsHandler(req: Request, res: Response) {
    try {
        // 1. Extract and Validate Parameters
        const lat = req.query.lat ? Number(req.query.lat) : null;
        const lon = req.query.lon ? Number(req.query.lon) : null;
        const radius_km = req.query.radius_km ? Number(req.query.radius_km) : null;
        const status = req.query.status ? String(req.query.status) : null;
        const type_id = req.query.type_id ? Number(req.query.type_id) : null;
        const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 50;

        const params: any[] = [];
        const whereClauses: string[] = ["hr.is_deleted = false"];

        // 2. Build Dynamic Filters

        // Filter by Status Name (e.g., 'official_verified')
        if (status) {
            params.push(`%${status}%`);
            whereClauses.push(`rs.status_name ILIKE $${params.length}`);
        }

        // Filter by Hazard Type ID
        if (type_id && !isNaN(type_id)) {
            params.push(type_id);
            whereClauses.push(`hr.hazard_type_id = $${params.length}`);
        }

        // Filter by Location (PostGIS ST_DWithin)
        // Note: ST_MakePoint takes (Longitude, Latitude) order
        if (lat !== null && lon !== null && radius_km !== null) {
            params.push(lon); // $N
            params.push(lat); // $N+1
            params.push(radius_km * 1000); // $N+2 (Convert km to meters)

            const pIdx = params.length - 2; // Index of longitude
            whereClauses.push(`
                ST_DWithin(
                    hr.location::geography, 
                    ST_SetSRID(ST_MakePoint($${pIdx}, $${pIdx + 1}), 4326)::geography, 
                    $${pIdx + 2}
                )
            `);
        }

        // 3. Add Limit Parameter
        params.push(limit);
        const limitParamIndex = params.length;

        // 4. Construct Final Query
        const query = `
            SELECT 
                hr.report_id,
                hr.description,
                hr.created_at as report_time,
                hr.relevance_score,
                hr.hazard_type_id,
                ht.type_name,
                hr.user_id,
                u.user_name,
                hr.status_id,
                rs.status_name,
                ST_AsGeoJSON(hr.location)::json as location,
                hr.location_name,
                COALESCE(
                    array_agg(rm.media_url) FILTER (WHERE rm.media_url IS NOT NULL), 
                    '{}'
                ) as media_urls
            FROM hazard_reports hr
            LEFT JOIN hazard_types ht ON hr.hazard_type_id = ht.type_id
            LEFT JOIN report_statuses rs ON hr.status_id = rs.status_id
            LEFT JOIN report_media rm ON hr.media_id = rm.media_id
            LEFT JOIN users u ON hr.user_id = u.user_id
            WHERE ${whereClauses.join(' AND ')}
            GROUP BY 
                hr.report_id, 
                ht.type_name, 
                rs.status_name, 
                u.user_name
            ORDER BY hr.report_time DESC
            LIMIT $${limitParamIndex};
        `;

        // 5. Execute
        const { rows } = await pool.query(query, params);

        return res.json(apiResponse(true, "Reports fetched successfully", rows));

    } catch (error) {
        console.error("Get Reports Error:", error);
        return res.status(500).json(apiResponse(false, "Internal Server Error", null));
    }
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
