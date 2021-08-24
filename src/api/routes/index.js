import { init as authInit } from './auth';
import { init as changeUserInit } from './changeUser';
import { init as commentInit } from './comment';
import { init as dataInit } from './data';
import { init as dneInit } from './dne';
import { init as fileInit } from './file';
import { init as file2Init } from './file2';
import { init as menuInit } from './menu';
import { init as processInit } from './process';
import { init as livechatInit } from './livechat';

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

export { init };
