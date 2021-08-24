import { init as authInit } from './auth';
import { init as collectionLoginInit } from './collectionLogin';
import { init as validationInit } from './validation';

const init = () => {
	authInit();
    collectionLoginInit();
    validationInit();
};

export { init };
