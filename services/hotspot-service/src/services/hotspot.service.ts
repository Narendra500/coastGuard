import { query } from '../db';

// These are your clustering rules. You can tune them later.
const CLUSTER_DISTANCE_KM = 1.5; // (eps) 1.5km radius
const MIN_REPORTS_IN_CLUSTER = 5; // (minPoints) 5 reports to make a hotspot
const REPORT_TIME_HOURS = 48; // Look at reports from the last 48 hours

// PostGIS's ST_ClusterDBSCAN measures distance in the query's unit.
// Since our data is in 4326 (lat/lon), we must set `eps` in meters.
const CLUSTER_DISTANCE_METERS = CLUSTER_DISTANCE_KM * 1000;

export const updateHotspots = async () => {
    console.log('Running hotspot update job...');
    const clusteringQuery = `
        WITH delete_old AS (
            DELETE FROM hotspots
        ),

        all_recent_reports AS (
            SELECT location, hazard_type_id
            FROM hazard_reports
            WHERE report_time > (NOW() - ($1::interval))
            AND status_id = (
                SELECT status_id
                FROM report_statuses
                WHERE status_name = 'Officially Verified'
                LIMIT 1
            )

            AND location IS NOT NULL

            UNION ALL

            SELECT location, NULL AS hazard_type_id
            FROM social_media_posts
            WHERE post_time > (NOW() - ($1::interval))
            AND relevance_score > 0.8
            AND location IS NOT NULL
        ),

        all_reports_for_clustering AS (
            SELECT
                location,
                hazard_type_id,
                ST_ClusterDBSCAN(
                ST_Transform(location, 3857),
                eps := $2,
                minpoints := $3
            ) OVER () AS cluster_id
            FROM all_recent_reports
        ),

        final_clusters AS (
            SELECT
                cluster_id,
                COUNT(*) AS report_count,
                ST_Centroid(ST_Collect(location)) AS center_location,
                (
                    SELECT hazard_type_id
                    FROM (
                        SELECT hazard_type_id, COUNT(*) AS type_count
                        FROM all_reports_for_clustering r2
                        WHERE r2.cluster_id = r.cluster_id
                        AND r2.hazard_type_id IS NOT NULL
                        GROUP BY hazard_type_id
                        ORDER BY type_count DESC
                        LIMIT 1
                    ) t
                ) AS dominant_hazard_type_id
            FROM all_reports_for_clustering r
            WHERE cluster_id IS NOT NULL
            GROUP BY cluster_id
        )

        INSERT INTO hotspots (location, radius_km, intensity_score, dominant_hazard_type_id)
        SELECT
            center_location,
            $4,
            CAST(report_count AS DECIMAL(4,2)),
            dominant_hazard_type_id
        FROM final_clusters
        WHERE report_count >= $3;
        `;
    const params = [
        `${REPORT_TIME_HOURS} hours`,   // $1 = INTERVAL duration
        CLUSTER_DISTANCE_METERS,        // $2 = eps (meters)
        MIN_REPORTS_IN_CLUSTER,         // $3 = minpoints + threshold
        CLUSTER_DISTANCE_KM             // $4 = radius_km stored in hotspots
    ];
    try {
        const result = await query(clusteringQuery, params);
        console.log(`Hotspot job complete. ${result.rowCount} hotspots inserted.`);
    } catch (err) {
        console.error('Error running hotspot update job:', err);
    }
};

// This function is for the API, it just reads the table



export const getActiveHotspots = async () => {
    // OLD QUERY:
    // const { rows } = await query('SELECT * FROM hotspots');

    // NEW, BETTER QUERY:
    const getHotspotsQuery = `
    SELECT
      hotspot_id,
      ST_AsGeoJSON(location)::json AS location, -- This is the magic part
      radius_km,
      intensity_score,
      dominant_hazard_type_id,
      created_at,
      updated_at
    FROM hotspots;
  `;

    const { rows } = await query(getHotspotsQuery);
    return rows;
};
