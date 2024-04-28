"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HourglassChart = void 0;
var ancestor_chart_1 = require("./ancestor-chart");
var chart_util_1 = require("./chart-util");
var descendant_chart_1 = require("./descendant-chart");
/**
 * Renders an hourglass chart. It consists of an ancestor chart and
 * a descendant chart for a family.
 */
var HourglassChart = /** @class */ (function () {
    function HourglassChart(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(options);
    }
    HourglassChart.prototype.render = function () {
        var ancestorsRoot = ancestor_chart_1.getAncestorsTree(this.options);
        var ancestorNodes = this.util.layOutChart(ancestorsRoot, {
            flipVertically: true,
        });
        var descendantNodes = descendant_chart_1.layOutDescendants(this.options);
        // slice(1) removes the duplicated start node.
        var nodes = ancestorNodes.slice(1).concat(descendantNodes);
        var animationPromise = this.util.renderChart(nodes);
        var info = chart_util_1.getChartInfo(nodes);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: animationPromise });
    };
    return HourglassChart;
}());
exports.HourglassChart = HourglassChart;
