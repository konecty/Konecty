module.exports = function (grunt) {
	grunt.initConfig({
		less: {
			development: {
				options: {},
				files: [
					{
						expand: true,
						src: 'konecty*.less',
						dest: '../../../public/components_v1/',
						ext: '.css',
					},
				],
			},
		},
	});
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.registerTask('default', ['less']);
};
