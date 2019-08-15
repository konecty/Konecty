import { Meteor } from 'meteor/meteor';

import { find, save } from './mongodb';

const storageModuleMongoDB = {
	init: (settings, runtime) => {
		console.log('init'.red);
	},
	getFlows: async () => {
		console.log('getFlows'.red);
		return find('flows', '/', []);
	},
	saveFlows: flows => {
		console.log('saveFlows'.red);
		return save('flows', '/', flows);
	},
	getCredentials: async () => {
		console.log('getCredentials'.red);
		return find('credentials', '/');
	},
	saveCredentials: credentials => {
		console.log('saveCredentials'.red);
		return save('credentials', '/', credentials);
	},
	getSettings: async () => {
		console.log('getSettings'.red);
		return find('settings', '/');
	},
	saveSettings: settings => {
		console.log('saveSettings'.red);
		return save('settings', '/', settings);
	},
	getSessions: () => {
		console.log('getSessions'.red);
		return find('sessions', '/');
	},
	saveSessions: sessions => {
		console.log('saveSessions'.red);
		return save('sessions', '/', sessions);
	},
	getLibraryEntry: (type, path) => {
		console.log('getLibraryEntry'.red, type, path);
		return find(`library-${type}`, path, []);
	},
	saveLibraryEntry: (type, path, meta, body) => {
		console.log('saveLibraryEntry'.red);
		return save(`library-${type}`, path, body, meta);
	}
};

export default storageModuleMongoDB;
