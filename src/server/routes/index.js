import authInit from './auth';
import changeUserInit from './changeUser';
import commentInit from './comment';
import dataInit from './data';
import dneInit from './dne';
import fileInit from './file';
import file2Init from './file2';
import menuInit from './menu';
import processInit from './process';
import livechatInit from './livechat';

const init = app => {
	authInit(app);
	changeUserInit(app);
	commentInit(app);
	dataInit(app);
	dneInit(app);
	fileInit(app);
	file2Init(app);
	menuInit(app);
	processInit(app);
	livechatInit(app);
};

// eslint-disable-next-line import/prefer-default-export
export { init };
