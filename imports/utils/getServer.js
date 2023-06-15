const getServer = url => {
	const { server } = /^((?<protocol>http[s]?))?(:)?(\/)?(\/)?(?<server>.*)/.exec(url).groups;
	return server;
};

export default getServer;
