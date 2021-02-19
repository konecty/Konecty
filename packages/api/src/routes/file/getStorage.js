import aws from 'aws-sdk';

export default () => {
	if (process.env.S3_DOMAIN != null) {
		return new aws.S3({
			apiVersion: '2006-03-01',
			endpoint: new aws.Endpoint(`${process.env.S3_REGION}.${process.env.S3_DOMAIN}`),
			accessKeyId: process.env.S3_ACCESSKEY,
			secretAccessKey: process.env.S3_SECRETKEY,
			region: process.env.S3_REGION,
		});
	}
	return new aws.S3({
		apiVersion: '2006-03-01',
		accessKeyId: process.env.S3_ACCESSKEY,
		secretAccessKey: process.env.S3_SECRETKEY,
		region: process.env.S3_REGION,
	});
};
