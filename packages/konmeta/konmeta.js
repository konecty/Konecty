import MetaObjects from './server/model/MetaObjects';

// creates a project scoped variable to be exported
MetaObject = MetaObjects;

import './server/api';
import './server/startup/bootstrap';
import './server/startup/observeMetas';
