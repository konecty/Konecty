import aws from 'aws-sdk';

export default ({ domain, accessKeyId, secretAccessKey, region }) => {
	if (domain != null) {
		return new aws.S3({
			apiVersion: '2006-03-01',
			endpoint: new aws.Endpoint(`${region}.${domain}`),
			accessKeyId,
			secretAccessKey,
			region,
		});
	}
	return new aws.S3({
		apiVersion: '2006-03-01',
		accessKeyId,
		secretAccessKey,
		region,
	});
};
