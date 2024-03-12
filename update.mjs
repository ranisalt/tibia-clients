// @ts-check
import { getLatestVersion } from "./lib/version.mjs";

const github_headers = {
	accept: "application/vnd.github+json",
	authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
	"content-type": "application/json",
	"x-github-api-version": "2022-11-28",
};

/**
 * @param {string | null} last_modified
 */
const getLatestSnapshot = async (last_modified) => {
	const snapshot_url = new URL("/wayback/available", "https://archive.org");
	snapshot_url.searchParams.set(
		"url",
		process.env.CLIENT_DOWNLOAD_PAGE_URL || "",
	);
	const snapshot_res = await fetch(snapshot_url);

	/**
	 * @typedef {Object} SnapshotResponse
	 * @property {string} url
	 * @property {Object} archived_snapshots
	 * @property {Object} archived_snapshots.closest
	 * @property {string} archived_snapshots.closest.status
	 * @property {boolean} archived_snapshots.closest.available
	 * @property {string} archived_snapshots.closest.url
	 * @property {string} archived_snapshots.closest.timestamp
	 */

	/** @type {SnapshotResponse} */
	const {
		archived_snapshots: {
			closest: { timestamp, url },
		},
	} = await snapshot_res.json();
	if (timestamp.length !== 14) {
		throw new Error(`Invalid timestamp ${timestamp}`);
	}

	const timestamp_date = new Date(
		Number(timestamp.slice(0, 4)),
		Number(timestamp.slice(4, 6)) - 1,
		Number(timestamp.slice(6, 8)),
		Number(timestamp.slice(8, 10)),
		Number(timestamp.slice(10, 12)),
		Number(timestamp.slice(12, 14)),
	);

	const last_modified_date = last_modified
		? new Date(last_modified)
		: new Date();

	if (last_modified_date <= timestamp_date) {
		return url;
	}

	const archive_url = new URL(
		`/save/${process.env.CLIENT_DOWNLOAD_PAGE_URL}`,
		"https://web.archive.org",
	);

	const archive_res = await fetch(archive_url, { method: "HEAD" });
	if (!archive_res.ok) {
		throw new Error(`Failed to fetch ${archive_url}`);
	}

	return archive_res.url;
};

/**
 * @param {number} release_id
 * @param {string} release_notes
 * @param {string} filename
 */
const uploadReleaseAsset = async (release_id, release_notes, filename) => {
	console.log(`Uploading ${filename} to release ${release_id}`);

	const launcher_res = await fetch(process.env.LAUNCHER_DOWNLOAD_URL || "");
	if (!launcher_res.ok) {
		throw new Error(`Failed to fetch ${process.env.LAUNCHER_DOWNLOAD_URL}`);
	}

	const last_modified = launcher_res.headers.get("last-modified");
	const latest_snapshot_prom = getLatestSnapshot(last_modified);

	const launcher_blob = await launcher_res.blob();
	const content_type =
		launcher_res.headers.get("content-type") || "application/x-gzip";

	const upload_asset_url = new URL(
		`/repos/ranisalt/tibia-clients/releases/${release_id}/assets`,
		"https://uploads.github.com",
	);
	upload_asset_url.searchParams.set("name", filename);

	const latest_snapshot_url = await latest_snapshot_prom;
	const [update_res, upload_res] = await Promise.all([
		fetch(
			`https://api.github.com/repos/ranisalt/tibia-clients/releases/${release_id}`,
			{
				method: "PATCH",
				headers: github_headers,
				body: JSON.stringify({
					body: `${release_notes}\n\nThis file was published on ${last_modified}\n\nA snapshot of the download page is available at ${latest_snapshot_url} for integrity checking.`,
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

const { GITHUB_TOKEN } = process.env;
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
		process.exit(0);
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

await uploadReleaseAsset(release_id, release_notes, filename);
