module.exports = function(grunt) {

	grunt.initConfig({
		watch: {
			javascript: {
				files: ['test/**/*.js', 'src/**/*.js'],
				tasks: ['tape', 'eslint']
			}
		},
		env: {
			options: {},
			test: {
				NODE_ENV: 'test'
			}
		},
		tape: {
			options: {
				pretty: false
			},
			files: ['test/**/*.js']
		},
		eslint: {
			options: {
			},
	        target: ['src/**/*.js']
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-tape');
	grunt.loadNpmTasks('grunt-env');
	grunt.loadNpmTasks('grunt-eslint');

	grunt.registerTask('default', ['tape']);
	grunt.registerTask('watchtests', ['env:test', 'watch:javascript']);

};