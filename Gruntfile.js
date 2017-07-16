module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({

        ts: {
            app: {
                files: [{
                    src: ["src/**/*.ts"],
                    dest: "./build/"
                }],
                options: {
                    module: "commonjs",
                    target: "es6",
                    noImplicitAny: false,
                    sourceMap: false,
                    experimentalDecorators: true
                }
            }
        },

        clean: ["./build/"],

        copy: {
            views: {
                expand: true,
                cwd: './src/views/',
                src: '**',
                dest: './build/views',
            },

            public: {
                expand: true,
                cwd: './src/public/',
                src: '**',
                dest: './build/public',
            }
        },

        watch: {
            typescript: {
                files: ["src/**/*.ts", "typings/**/*.d.ts"],
                tasks: ["ts"]
            },

            views: {
                files: ["src/views/**/*", "src/public/**/*"],
                tasks: ["copy"]
            }
        }
    });

    grunt.loadNpmTasks("grunt-ts");
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask("build", ["clean", "ts", "copy"]);
    grunt.registerTask("rebuild", ["ts", "copy"]);
};