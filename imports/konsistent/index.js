import { Konsistent } from './consts';
import './history';

Konsistent.start = function () {
	Konsistent.History.setup();
};

export { Konsistent };
