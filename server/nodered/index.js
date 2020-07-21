import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import aws from 'aws-sdk';
import RED from 'node-red';
import jsdom from 'jsdom';
import adminAuth from './adminAuth';
import storageModule from './storageModule';
import getCollection from './getCollection';

// for D3 compatibility on server
const { JSDOM } = jsdom;
const window = new JSDOM('').window;
global.window = window;
global.document = window.document;

const ensurePath = path =>
	path
		.split('/')
		.filter(p => p)
		.join('/');

const endpoint = process.env.S3_DOMAIN != null ? new aws.Endpoint(`${process.env.S3_REGION}.${process.env.S3_DOMAIN}`) : new aws.Endpoint('amazonaws.com');

const init = async () => {
	const httpAdminRoot = `/${ensurePath(process.env.NR_ADMIN || 'flows')}`;
	const httpNodeRoot = `/${ensurePath(process.env.NR_API || 'api')}`;
	const settings = {
		httpAdminRoot,
		httpNodeRoot,
		adminAuth,
		storageModule,
		functionGlobalContext: {
			lodash: require('lodash'),
			slugify: require('slugify'),
			d3: require('d3'),
			sharp: require('sharp'),
			FuzzySet: require('fuzzyset.js'),
			crypto: require('crypto'),
			getCollection: getCollection,
			geolib: require('geolib'),
			uuid: require('uuid'),
			jwt: require('jsonwebtoken'),
			aws,
			s3: new aws.S3({
				apiVersion: '2006-03-01',
				endpoint,
				accessKeyId: process.env.S3_ACCESSKEY,
				secretAccessKey: process.env.S3_SECREDKEY,
				region: process.env.S3_REGION,
			}),
		},
	};

	await RED.init(WebApp.httpServer, settings);

	WebApp.connectHandlers.use(settings.httpAdminRoot, RED.httpAdmin);

	WebApp.connectHandlers.use(settings.httpNodeRoot, RED.httpNode);

	await RED.start();
};

Meteor.startup(() => {
	if (/true|1|enable/i.test(process.env.NR_ENABLE)) {
		init();
	}
});
