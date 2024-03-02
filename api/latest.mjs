// @ts-check
import { getLatestVersion } from "../lib/version.mjs";

export const config = { runtime: "edge" };

/**
 * @returns {Promise<Response>}
 */
export const GET = async () => Response.json(await getLatestVersion());
