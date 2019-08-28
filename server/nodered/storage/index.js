import { Meteor } from 'meteor/meteor';

import { find, save } from './mongodb';

const storageModuleMongoDB = {
	init: (settings, runtime) => {
		console.log('init'.red);
	},
	getFlows: async () => {
		return find('flows', '/', []);
	},
	saveFlows: flows => {
		return save('flows', '/', flows);
	},
	getCredentials: async () => {
		return find('credentials', '/');
	},
	saveCredentials: credentials => {
		return save('credentials', '/', credentials);
	},
	getSettings: async () => {
		return find('settings', '/');
	},
	saveSettings: settings => {
		return save('settings', '/', settings);
	},
	getSessions: () => {
		return find('sessions', '/');
	},
	saveSessions: sessions => {
		return save('sessions', '/', sessions);
	},
	getLibraryEntry: (type, path) => {
		return find(`library-${type}`, path, []);
	},
	saveLibraryEntry: (type, path, meta, body) => {
		return save(`library-${type}`, path, body, meta);
	}
};

export default storageModuleMongoDB;
