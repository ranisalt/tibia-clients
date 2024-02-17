import * as blob from "@vercel/blob";
import { kv } from "@vercel/kv";

async function getLatestVersion() {
	const response = await fetch(
		"https://static.tibia.com/launcher/launcher-windows-current/package.json.version",
	);

	return response.text();
}

async function getLatestBlob() {
	const response = await fetch(
		"https://static.tibia.com/download/tibia.x64.tar.gz",
	);

	return response.body;
}

async function checkForUpdates() {
	const version = await getLatestVersion();
	if ((await kv.get("latest")) === version) {
		console.log("No updates");
		return blob.getDownloadUrl(`tibia-${version}.tar.gz`);
	}

	const body = await getLatestBlob();
	const { url } = await blob.put(`tibia-${version}.tar.gz`, body, {
		access: "public",
		addRandomSuffix: false,
	});

	await kv.set(`blob-url-${version}`, url);
	await kv.set("latest", version);
	
	return url;
}

export async function GET() {
	const location = await checkForUpdates();

	return new Response(null, { headers: { location }, status: 307 });
}
