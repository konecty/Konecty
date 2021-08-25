import deleteInit from './delete';
import downloadInit from './download';
import imageInit from './image';
import uploadInit from './upload';

export default app => {
	deleteInit(app);
	downloadInit(app);
	imageInit(app);
	uploadInit(app);
};
