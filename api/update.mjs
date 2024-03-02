// @ts-check
import { Octokit } from "octokit";
import { getLatestVersion } from "../lib/version.mjs";

export const config = { runtime: "edge" };

const { rest } = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * @param {Request} req
 * @returns {Promise<Response>}
 */
export const GET = async (req) => {
	const { CRON_SECRET, CLIENT_DOWNLOAD_PAGE_URL, LAUNCHER_DOWNLOAD_URL } =
		process.env;

	if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
		return new Response(null, { status: 401 });
	}

	if (!LAUNCHER_DOWNLOAD_URL) {
		return new Response(null, { status: 500 });
	}

	const { clientVersion, launcherVersion } = await getLatestVersion();
	const filename = `tibia-x64-v${launcherVersion}.tar.gz`;

	let release_id;
	try {
		const { data } = await rest.repos.getReleaseByTag({
			owner: "ranisalt",
			repo: "tibia-clients",
			tag: `v${launcherVersion}`,
		});

		const asset = data.assets.find(({ name }) => name === filename);
		// if the asset exists, we don't need to do anything
		if (asset) {
			return new Response(null, { status: 204 });
		}

		release_id = data.id;
	} catch {
		const res = await fetch(
			`https://web.archive.org/save/${CLIENT_DOWNLOAD_PAGE_URL}`,
		);
		if (!res.ok) {
			throw new Error(`Failed to fetch ${CLIENT_DOWNLOAD_PAGE_URL}`);
		}

		const { data } = await rest.repos.createRelease({
			owner: "ranisalt",
			repo: "tibia-clients",
			tag_name: `v${launcherVersion}`,
			name: `${clientVersion}`,
			body: `This release contains the Tibia client version ${clientVersion} and the launcher version ${launcherVersion}.\n\nA snapshot of the download page is available at ${res.url} for integrity checking.`,
		});

		release_id = data.id;
	}

	const res = await fetch(LAUNCHER_DOWNLOAD_URL);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${LAUNCHER_DOWNLOAD_URL}`);
	}

	await rest.repos.uploadReleaseAsset({
		owner: "ranisalt",
		repo: "tibia-clients",
		release_id: release_id,
		headers: { contentType: "application/gzip" },
		// @ts-ignore
		data: await res.blob(),
		name: filename,
	});

	return new Response(null, { status: 201 });
};
