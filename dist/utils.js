"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.points2pathd = exports.zip = exports.last = exports.nonEmpty = void 0;
function nonEmpty(array) {
    return !!(array && array.length);
}
exports.nonEmpty = nonEmpty;
function last(array) {
    return array[array.length - 1];
}
exports.last = last;
function zip(a, b) {
    return a.map(function (e, i) { return [e, b[i]]; });
}
exports.zip = zip;
function points2pathd(points) {
    var result = "M " + points[0].x + " " + points[0].y + " L";
    for (var _i = 0, _a = points.slice(1); _i < _a.length; _i++) {
        var s = _a[_i];
        result += " " + s.x + " " + s.y;
    }
    return result;
}
exports.points2pathd = points2pathd;
