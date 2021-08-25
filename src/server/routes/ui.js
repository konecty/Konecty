import express from 'express';
import path from 'path';

export default app => {
	app.rawApp.use(express.static(path.join(__dirname, 'ui')));
};
