// @ts-check
import { getLatestVersion } from "../lib/version.mjs";

/**
 * @returns {Promise<Response>}
 */
export const GET = async () => Response.json(await getLatestVersion());
