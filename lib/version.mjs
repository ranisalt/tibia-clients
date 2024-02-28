// @ts-check
const { CLIENT_VERSION_URL, LAUNCHER_VERSION_URL } = process.env;

/**
 * @returns {Promise<{ clientVersion: string, launcherVersion: string }>}
 */
export const getLatestVersion = async () => {
	if (!CLIENT_VERSION_URL || !LAUNCHER_VERSION_URL) {
		throw new Error("Missing CLIENT_VERSION_URL or LAUNCHER_VERSION_URL");
	}

	const [clientVersion, launcherVersion] = await Promise.all([
		fetch(CLIENT_VERSION_URL).then((res) => res.text()),
		fetch(LAUNCHER_VERSION_URL).then((res) => res.text()),
	]);

	return { clientVersion, launcherVersion };
};
