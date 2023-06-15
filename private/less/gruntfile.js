module.exports = function (grunt) {
	grunt.initConfig({
		less: {
			development: {
				options: {},
				files: [
					{
						expand: true,
						src: 'konecty*.less',
						dest: '../../public/components/',
						ext: '.css',
					},
				],
			},
		},
	});
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.registerTask('default', ['less']);
};
