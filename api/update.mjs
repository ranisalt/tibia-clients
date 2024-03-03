// @ts-check
import { getLatestVersion } from "../lib/version.mjs";

export const config = { runtime: "edge" };

const github_headers = {
	accept: "application/vnd.github+json",
	authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
	"content-type": "application/json",
	"x-github-api-version": "2022-11-28",
};

/**
 * @param {number} release_id
 * @param {string} release_notes
 * @param {string} filename
 */
const uploadReleaseAsset = async (release_id, release_notes, filename) => {
	console.log(`Uploading ${filename} to release ${release_id}`);

	const archive_url = new URL(
		`/save/${process.env.CLIENT_DOWNLOAD_PAGE_URL}`,
		"https://web.archive.org",
	);
	const [archive_res, launcher_res] = await Promise.all([
		fetch(archive_url, { method: "HEAD" }),
		fetch(process.env.LAUNCHER_DOWNLOAD_URL),
	]);

	if (!archive_res.ok) {
		throw new Error(`Failed to fetch ${archive_url}`);
	}

	if (!launcher_res.ok) {
		throw new Error(`Failed to fetch ${process.env.LAUNCHER_DOWNLOAD_URL}`);
	}

	const launcher_blob = await launcher_res.blob();
	const content_type =
		launcher_res.headers.get("content-type") || "application/x-gzip";
	const last_modified = launcher_res.headers.get("last-modified");

	const upload_asset_url = new URL(
		`/repos/ranisalt/tibia-clients/releases/${release_id}/assets`,
		"https://uploads.github.com",
	);
	upload_asset_url.searchParams.set("name", filename);
	console.log(upload_asset_url);

	const [update_res, upload_res] = await Promise.all([
		fetch(
			`https://api.github.com/repos/ranisalt/tibia-clients/releases/${release_id}`,
			{
				method: "PATCH",
				headers: github_headers,
				body: JSON.stringify({
					body: `${release_notes}\n\nThis file was published on ${last_modified}\n\nA snapshot of the download page is available at ${archive_res.url} for integrity checking.`,
				}),
			},
		),
		fetch(upload_asset_url, {
			method: "POST",
			headers: { ...github_headers, "content-type": content_type },
			body: launcher_blob,
		}),
	]);

	if (!update_res.ok) {
		console.log(await update_res.text());
		throw new Error(`Failed to update release ${release_id}`);
	}

	if (!upload_res.ok) {
		console.log(await upload_res.text());
		throw new Error(`Failed to upload asset ${filename}`);
	}

	console.log(`Uploaded ${filename} to release ${release_id}`);
};

/**
 * @param {Request} req
 * @param {import("@vercel/edge").RequestContext} ctx
 * @returns {Promise<Response>}
 */
export const GET = async (req, ctx) => {
	const { CRON_SECRET, GITHUB_TOKEN } = process.env;

	if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
		return new Response(null, { status: 401 });
	}

	if (!GITHUB_TOKEN) {
		throw new Error("Missing GITHUB_TOKEN");
	}

	const { clientVersion, launcherVersion } = await getLatestVersion();
	const filename = `tibia-x64-v${launcherVersion}.tar.gz`;

	const release_notes = `This release contains the Tibia client version ${clientVersion} and the launcher version ${launcherVersion}.`;

	const get_release_res = await fetch(
		`https://api.github.com/repos/ranisalt/tibia-clients/releases/tags/v${launcherVersion}`,
		{ headers: github_headers },
	);

	/** @type {number | undefined} */
	let release_id;

	if (get_release_res.ok) {
		console.log(`Release v${launcherVersion} already exists`);

		/** @type {{ id: number; assets: { name: string }[] }} */
		const { id, assets } = await get_release_res.json();

		const asset = assets.find(({ name }) => name === filename);
		// if the asset exists, we don't need to do anything
		if (asset) {
			console.log(`Asset ${filename} already exists`);
			return new Response(null, { status: 204 });
		}

		release_id = id;
	} else {
		console.log(`Creating release v${launcherVersion}`);

		const create_release_res = await fetch(
			"https://api.github.com/repos/ranisalt/tibia-clients/releases",
			{
				method: "POST",
				headers: github_headers,
				body: JSON.stringify({
					tag_name: `v${launcherVersion}`,
					name: `${clientVersion}`,
					body: release_notes,
				}),
			},
		);

		/** @type {{ id: number }} */
		const { id } = await create_release_res.json();
		release_id = id;
	}

	ctx.waitUntil(uploadReleaseAsset(release_id, release_notes, filename));

	return new Response(null, { status: 201 });
};
