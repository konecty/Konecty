import { init as deleteInit } from './delete';
import { init as downloadInit } from './download';
import { init as imageInit } from './image';
import { init as uploadInit } from './upload';

const init = app => {
	deleteInit(app);
	downloadInit(app);
	imageInit(app);
	uploadInit(app);
};

export { init };
