"use strict";
/// <reference path="d3-flextree.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartUtil = exports.getChartInfoWithoutMargin = exports.getChartInfo = exports.linkId = exports.V_SPACING = exports.H_SPACING = void 0;
var d3_selection_1 = require("d3-selection");
var d3_flextree_1 = require("d3-flextree");
var d3_array_1 = require("d3-array");
require("d3-transition");
/** Horizontal distance between boxes. */
exports.H_SPACING = 15;
/** Vertical distance between boxes. */
exports.V_SPACING = 30;
/** Margin around the whole drawing. */
var MARGIN = 15;
var HIDE_TIME_MS = 200;
var MOVE_TIME_MS = 500;
/** Assigns an identifier to a link. */
function linkId(node) {
    if (!node.parent) {
        return node.id + ":A";
    }
    var _a = node.data.generation > node.parent.data.generation
        ? [node.data, node.parent.data]
        : [node.parent.data, node.data], child = _a[0], parent = _a[1];
    if (child.additionalMarriage) {
        return child.id + ":A";
    }
    return parent.id + ":" + child.id;
}
exports.linkId = linkId;
function getChartInfo(nodes) {
    // Calculate chart boundaries.
    var x0 = d3_array_1.min(nodes, function (d) { return d.x - d.data.width / 2; }) - MARGIN;
    var y0 = d3_array_1.min(nodes, function (d) { return d.y - d.data.height / 2; }) - MARGIN;
    var x1 = d3_array_1.max(nodes, function (d) { return d.x + d.data.width / 2; }) + MARGIN;
    var y1 = d3_array_1.max(nodes, function (d) { return d.y + d.data.height / 2; }) + MARGIN;
    return { size: [x1 - x0, y1 - y0], origin: [-x0, -y0] };
}
exports.getChartInfo = getChartInfo;
function getChartInfoWithoutMargin(nodes) {
    // Calculate chart boundaries.
    var x0 = d3_array_1.min(nodes, function (d) { return d.x - d.data.width / 2; });
    var y0 = d3_array_1.min(nodes, function (d) { return d.y - d.data.height / 2; });
    var x1 = d3_array_1.max(nodes, function (d) { return d.x + d.data.width / 2; });
    var y1 = d3_array_1.max(nodes, function (d) { return d.y + d.data.height / 2; });
    return { size: [x1 - x0, y1 - y0], origin: [-x0, -y0] };
}
exports.getChartInfoWithoutMargin = getChartInfoWithoutMargin;
/** Utility class with common code for all chart types. */
var ChartUtil = /** @class */ (function () {
    function ChartUtil(options) {
        this.options = options;
    }
    /** Creates a path from parent to the child node (horizontal layout). */
    ChartUtil.prototype.linkHorizontal = function (s, d) {
        var sAnchor = this.options.renderer.getFamilyAnchor(s.data);
        var dAnchor = s.id === d.data.spouseParentNodeId
            ? this.options.renderer.getSpouseAnchor(d.data)
            : this.options.renderer.getIndiAnchor(d.data);
        var _a = [s.x + sAnchor[0], s.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [d.x + dAnchor[0], d.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        var midX = (s.x + s.data.width / 2 + d.x - d.data.width / 2) / 2;
        return "M " + sx + " " + sy + "\n            L " + midX + " " + sy + ",\n              " + midX + " " + dy + ",\n              " + dx + " " + dy;
    };
    /** Creates a path from parent to the child node (vertical layout). */
    ChartUtil.prototype.linkVertical = function (s, d) {
        var sAnchor = this.options.renderer.getFamilyAnchor(s.data);
        var dAnchor = s.id === d.data.spouseParentNodeId
            ? this.options.renderer.getSpouseAnchor(d.data)
            : this.options.renderer.getIndiAnchor(d.data);
        var _a = [s.x + sAnchor[0], s.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [d.x + dAnchor[0], d.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        var midY = s.y + s.data.height / 2 + exports.V_SPACING / 2;
        return "M " + sx + " " + sy + "\n            L " + sx + " " + midY + ",\n              " + dx + " " + midY + ",\n              " + dx + " " + dy;
    };
    ChartUtil.prototype.linkAdditionalMarriage = function (node) {
        var nodeIndex = node.parent.children.findIndex(function (n) { return n.data.id === node.data.id; });
        // Assert nodeIndex > 0.
        var siblingNode = node.parent.children[nodeIndex - 1];
        var sAnchor = this.options.renderer.getIndiAnchor(node.data);
        var dAnchor = this.options.renderer.getIndiAnchor(siblingNode.data);
        var _a = [node.x + sAnchor[0], node.y + sAnchor[1]], sx = _a[0], sy = _a[1];
        var _b = [siblingNode.x + dAnchor[0], siblingNode.y + dAnchor[1]], dx = _b[0], dy = _b[1];
        return "M " + sx + ", " + sy + "\n            L " + dx + ", " + dy;
    };
    ChartUtil.prototype.updateSvgDimensions = function (chartInfo) {
        var svg = d3_selection_1.select(this.options.svgSelector);
        var group = svg.select('g');
        var transition = this.options.animate
            ? group.transition().delay(HIDE_TIME_MS).duration(MOVE_TIME_MS)
            : group;
        transition.attr('transform', "translate(" + chartInfo.origin[0] + ", " + chartInfo.origin[1] + ")");
    };
    ChartUtil.prototype.layOutChart = function (root, layoutOptions) {
        var _this = this;
        if (layoutOptions === void 0) { layoutOptions = {}; }
        // Add styles so that calculating text size is correct.
        var svg = d3_selection_1.select(this.options.svgSelector);
        if (svg.select('style').empty()) {
            svg.append('style').text(this.options.renderer.getCss());
        }
        // Assign generation number.
        root.each(function (node) {
            node.data.generation =
                node.depth * (layoutOptions.flipVertically ? -1 : 1) +
                    (_this.options.baseGeneration || 0);
        });
        // Set preferred sizes.
        this.options.renderer.updateNodes(root.descendants());
        var vSizePerDepth = new Map();
        root.each(function (node) {
            var depth = node.depth;
            var maxVSize = d3_array_1.max([
                _this.options.horizontal ? node.data.width : node.data.height,
                vSizePerDepth.get(depth),
            ]);
            vSizePerDepth.set(depth, maxVSize);
        });
        // Set sizes of whole nodes.
        root.each(function (node) {
            var vSize = vSizePerDepth.get(node.depth);
            if (_this.options.horizontal) {
                node.data.width = vSize;
            }
            else {
                node.data.height = vSize;
            }
        });
        var vSpacing = layoutOptions.vSpacing !== undefined ? layoutOptions.vSpacing : exports.V_SPACING;
        var hSpacing = layoutOptions.hSpacing !== undefined ? layoutOptions.hSpacing : exports.H_SPACING;
        // Assigns the x and y position for the nodes.
        var treemap = d3_flextree_1.flextree()
            .nodeSize(function (node) {
            if (_this.options.horizontal) {
                var maxChildSize_1 = d3_array_1.max(node.children || [], function (n) { return n.data.width; }) || 0;
                return [
                    node.data.height,
                    (maxChildSize_1 + node.data.width) / 2 + vSpacing,
                ];
            }
            var maxChildSize = d3_array_1.max(node.children || [], function (n) { return n.data.height; }) || 0;
            return [
                node.data.width,
                (maxChildSize + node.data.height) / 2 + vSpacing,
            ];
        })
            .spacing(function (a, b) { return hSpacing; });
        var nodes = treemap(root).descendants();
        // Swap x-y coordinates for horizontal layout.
        nodes.forEach(function (node) {
            var _a;
            if (layoutOptions.flipVertically) {
                node.y = -node.y;
            }
            if (_this.options.horizontal) {
                _a = [node.y, node.x], node.x = _a[0], node.y = _a[1];
            }
        });
        return nodes;
    };
    ChartUtil.prototype.renderChart = function (nodes) {
        var svg = this.getSvgForRendering();
        var nodeAnimation = this.renderNodes(nodes, svg);
        var linkAnimation = this.renderLinks(nodes, svg);
        return Promise.all([
            nodeAnimation,
            linkAnimation,
        ]);
    };
    ChartUtil.prototype.renderNodes = function (nodes, svg) {
        var _this = this;
        var animationPromise = new Promise(function (resolve) {
            var boundNodes = svg
                .select('g')
                .selectAll('g.node')
                .data(nodes, function (d) { return d.id; });
            var nodeEnter = boundNodes.enter().append('g');
            var transitionsPending = boundNodes.exit().size() + boundNodes.size() + nodeEnter.size();
            var transitionDone = function () {
                transitionsPending--;
                if (transitionsPending === 0) {
                    resolve();
                }
            };
            if (!_this.options.animate || transitionsPending === 0) {
                resolve();
            }
            nodeEnter
                .merge(boundNodes)
                .attr('class', function (node) { return "node generation" + node.data.generation; });
            nodeEnter.attr('transform', function (node) {
                return "translate(" + (node.x - node.data.width / 2) + ", " + (node.y - node.data.height / 2) + ")";
            });
            if (_this.options.animate) {
                nodeEnter
                    .style('opacity', 0)
                    .transition()
                    .delay(HIDE_TIME_MS + MOVE_TIME_MS)
                    .duration(HIDE_TIME_MS)
                    .style('opacity', 1)
                    .on('end', transitionDone);
            }
            var updateTransition = _this.options.animate
                ? boundNodes
                    .transition()
                    .delay(HIDE_TIME_MS)
                    .duration(MOVE_TIME_MS)
                    .on('end', transitionDone)
                : boundNodes;
            updateTransition.attr('transform', function (node) {
                return "translate(" + (node.x - node.data.width / 2) + ", " + (node.y - node.data.height / 2) + ")";
            });
            _this.options.renderer.render(nodeEnter, boundNodes);
            if (_this.options.animate) {
                boundNodes
                    .exit()
                    .transition()
                    .duration(HIDE_TIME_MS)
                    .style('opacity', 0)
                    .remove()
                    .on('end', transitionDone);
            }
            else {
                boundNodes.exit().remove();
            }
        });
        return animationPromise;
    };
    ChartUtil.prototype.renderLinks = function (nodes, svg) {
        var _this = this;
        var animationPromise = new Promise(function (resolve) {
            var link = function (parent, child) {
                if (child.data.additionalMarriage) {
                    return _this.linkAdditionalMarriage(child);
                }
                var flipVertically = parent.data.generation > child.data.generation;
                if (_this.options.horizontal) {
                    if (flipVertically) {
                        return _this.linkHorizontal(child, parent);
                    }
                    return _this.linkHorizontal(parent, child);
                }
                if (flipVertically) {
                    return _this.linkVertical(child, parent);
                }
                return _this.linkVertical(parent, child);
            };
            var links = nodes.filter(function (n) { return !!n.parent || n.data.additionalMarriage; });
            var boundLinks = svg
                .select('g')
                .selectAll('path.link')
                .data(links, linkId);
            var path = boundLinks
                .enter()
                .insert('path', 'g')
                .attr('class', function (node) {
                return node.data.additionalMarriage ? 'link additional-marriage' : 'link';
            })
                .attr('d', function (node) { return link(node.parent, node); });
            var transitionsPending = boundLinks.exit().size() + boundLinks.size() + path.size();
            var transitionDone = function () {
                transitionsPending--;
                if (transitionsPending === 0) {
                    resolve();
                }
            };
            if (!_this.options.animate || transitionsPending === 0) {
                resolve();
            }
            var linkTransition = _this.options.animate
                ? boundLinks
                    .transition()
                    .delay(HIDE_TIME_MS)
                    .duration(MOVE_TIME_MS)
                    .on('end', transitionDone)
                : boundLinks;
            linkTransition.attr('d', function (node) { return link(node.parent, node); });
            if (_this.options.animate) {
                path
                    .style('opacity', 0)
                    .transition()
                    .delay(2 * HIDE_TIME_MS + MOVE_TIME_MS)
                    .duration(0)
                    .style('opacity', 1)
                    .on('end', transitionDone);
            }
            if (_this.options.animate) {
                boundLinks
                    .exit()
                    .transition()
                    .duration(0)
                    .style('opacity', 0)
                    .remove()
                    .on('end', transitionDone);
            }
            else {
                boundLinks.exit().remove();
            }
        });
        return animationPromise;
    };
    ChartUtil.prototype.getSvgForRendering = function () {
        var svg = d3_selection_1.select(this.options.svgSelector);
        if (svg.select('g').empty()) {
            svg.append('g');
        }
        return svg;
    };
    return ChartUtil;
}());
exports.ChartUtil = ChartUtil;
