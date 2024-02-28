// @ts-check
import { Octokit } from "octokit";
import { getLatestVersion } from "../lib/version.mjs";

const { rest } = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * @param {Request} req
 * @returns {Promise<Response>}
 */
export const GET = async (req) => {
	const { CRON_SECRET, LAUNCHER_DOWNLOAD_URL } = process.env;

	if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
		return new Response(null, { status: 401 });
	}

	if (!LAUNCHER_DOWNLOAD_URL) {
		return new Response(null, { status: 500 });
	}

	const { clientVersion, launcherVersion } = await getLatestVersion();
	const filename = `tibia-x64-v${launcherVersion}.tar.gz`;

	let releaseId;
	try {
		const { data } = await rest.repos.getReleaseByTag({
			owner: "ranisalt",
			repo: "tibia-clients",
			tag: `v${launcherVersion}`,
		});

		const asset = data.assets.find(({ name }) => name === filename);
		// if the asset exists, we don't need to do anything
		if (asset) {
			return new Response(null, { status: 200 });
		}

		releaseId = data.id;
	} catch {
		const { data } = await rest.repos.createRelease({
			owner: "ranisalt",
			repo: "tibia-clients",
			tag_name: `v${launcherVersion}`,
			name: `${clientVersion}`,
		});

		releaseId = data.id;
	}

	const res = await fetch(LAUNCHER_DOWNLOAD_URL);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${LAUNCHER_DOWNLOAD_URL}`);
	}

	await rest.repos.uploadReleaseAsset({
		owner: "ranisalt",
		repo: "tibia-clients",
		release_id: releaseId,
		headers: { contentType: "application/gzip" },
		// @ts-ignore
		data: await res.blob(),
		name: filename,
	});

	return new Response(null, { status: 200 });
};
