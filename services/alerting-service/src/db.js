import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.pg.connectionString,
});

const client = await pool.connect();

/**
 * findUsersNearby: returns array of users within radius.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm
 * @param {string[] | null} targetRoles - Array of roles to filter by (e.g. ['official', 'citizen']) or null for ALL.
 */
export async function findUsersNearby(lat, lon, radiusKm, targetRoles = null) {
  const radiusMeters = radiusKm * 1000;

  // Logic: If targetRoles is provided, filter by it. If null, ignore role filter (Broadcast).
  const roleFilterClause = targetRoles ? "AND ur.role_name = ANY($4)" : "";

  const sql = `
    SELECT u.user_id, u.user_name, u.email, u.phone, ur.role_name,
           ST_Distance(u.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
    FROM users u
    JOIN user_roles ur ON u.user_role_id = ur.role_id
    WHERE u.location IS NOT NULL
      AND ST_DWithin(u.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ${roleFilterClause}
    ORDER BY distance_m ASC;
  `;

  const vals = [lon, lat, radiusMeters];

  if (targetRoles) {
    vals.push(targetRoles);
  }

  const { rows } = await client.query(sql, vals);
  return rows;
}
