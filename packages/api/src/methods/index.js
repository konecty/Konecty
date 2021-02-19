import { init as methodsHooksInit } from './hooks';
import { init as methodsMiddlewaresInit } from './middlewares';

import { init as authMethodsInit } from './auth';
import { init as changeUserMethodsInit } from './changeUser';
import { init as commentsMethodsInit } from './comments';
import { init as dataMethodsInit } from './data';
import { init as dneMethodsInit } from './dne';
import { init as fileMethodsInit } from './file';
import { init as historyMethodsInit } from './history';
import { init as menuMethodsInit } from './menu';
import { init as processMethodsInit } from './process';

const init = () => {
	methodsHooksInit();
	methodsMiddlewaresInit();
	authMethodsInit();
	changeUserMethodsInit();
	commentsMethodsInit();
	dataMethodsInit();
	dneMethodsInit();
	fileMethodsInit();
	historyMethodsInit();
	menuMethodsInit();
	processMethodsInit();
};

export { init };
