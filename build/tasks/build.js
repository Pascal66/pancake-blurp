/**
 * Created by Pascal on 13/01/2017.
 */
const gulp = require("gulp");
const sourceMaps = require("gulp-sourcemaps");
const babel = require("gulp-babel");

gulp.task('build', function () {
return gulp.src("src/**/*.js") //get all js files under the src
    .pipe(sourceMaps.init()) //initialize source mapping
    .pipe(babel()) //transpile
    .pipe(sourceMaps.write(".")) //write source maps
    .pipe(gulp.dest("dist")); //pipe to the destination folder
});