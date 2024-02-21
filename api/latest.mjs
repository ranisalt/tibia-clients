// @ts-check
import { kv } from "@vercel/kv";

const clientUrl = process.env.CLIENT_URL || "";
const versionUrl = process.env.VERSION_URL || "";

const isCacheHot = async () => {
	/** @type {string | null} */
	const savedExpires = await kv.get("expires");
	if (!savedExpires) return false;

	return new Date(savedExpires) > new Date();
};

const getLatestVersion = async () => {
	const headers = new Headers();

	/** @type {string | null} */
	const lastModified = await kv.get("last-modified");
	if (lastModified) headers.set("if-modified-since", lastModified);

	const response = await fetch(versionUrl, { headers });
	const expires = response.headers.get("expires");

	switch (response.status) {
		case 200:
			return {
				expires,
				lastModified: response.headers.get("last-modified"),
				version: await response.text(),
			};

		case 304:
			return { expires, lastModified, version: await kv.get("version") };

		default:
			throw new Error(`Unexpected status code: ${response.status}`);
	}
};

/**
 * @returns {Promise<{ lastModified: string | null, version: string | null }>}
 */
const checkForUpdates = async () => {
	if (await isCacheHot()) {
		console.log("Cache hit");
		return {
			lastModified: await kv.get("last-modified"),
			version: await kv.get("version"),
		};
	}

	const { expires, lastModified, version } = await getLatestVersion();

	await Promise.all([
		kv.set("expires", expires),
		kv.set("last-modified", lastModified),
		kv.set("version", version),
	]);

	return { lastModified, version };
};

export const GET = async () =>
	Response.json({ ...(await checkForUpdates()), url: clientUrl });
