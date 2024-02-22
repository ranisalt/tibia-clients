// @ts-check
import { Octokit } from "octokit";

const { rest } = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const GET = async () => {
	const { data } = await rest.repos.getLatestRelease({
		owner: "ranisalt",
		repo: "tibia-clients",
	});

	const asset = data.assets.find(
		({ name }) => name.startsWith("tibia-x64-v") && name.endsWith(".tar.gz"),
	);

	if (asset) {
		return Response.redirect(asset.browser_download_url, 307);
	}

	return new Response(null, { status: 404 });
};
