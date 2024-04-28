"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelativesChart = void 0;
var ancestor_chart_1 = require("./ancestor-chart");
var id_generator_1 = require("./id-generator");
var descendant_chart_1 = require("./descendant-chart");
var d3_array_1 = require("d3-array");
var chart_util_1 = require("./chart-util");
/** A view of a family that hides one child individual. */
var FilterChildFam = /** @class */ (function () {
    function FilterChildFam(fam, childId) {
        this.fam = fam;
        this.childId = childId;
    }
    FilterChildFam.prototype.getId = function () {
        return this.fam.getId();
    };
    FilterChildFam.prototype.getFather = function () {
        return this.fam.getFather();
    };
    FilterChildFam.prototype.getMother = function () {
        return this.fam.getMother();
    };
    FilterChildFam.prototype.getChildren = function () {
        var children = __spreadArray([], this.fam.getChildren());
        var index = children.indexOf(this.childId);
        if (index !== -1) {
            children.splice(index, 1);
        }
        return children;
    };
    return FilterChildFam;
}());
/** Data provider proxy that filters out a specific child individual. */
var FilterChildData = /** @class */ (function () {
    function FilterChildData(data, childId) {
        this.data = data;
        this.childId = childId;
    }
    FilterChildData.prototype.getIndi = function (id) {
        return this.data.getIndi(id);
    };
    FilterChildData.prototype.getFam = function (id) {
        return new FilterChildFam(this.data.getFam(id), this.childId);
    };
    return FilterChildData;
}());
/** Chart layout showing all relatives of a person. */
var RelativesChart = /** @class */ (function () {
    function RelativesChart(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(options);
        this.options.idGenerator = this.options.idGenerator || new id_generator_1.IdGenerator();
    }
    RelativesChart.prototype.layOutAncestorDescendants = function (ancestorsRoot, focusedNode) {
        // let ancestorDescentants: Array<HierarchyPointNode<TreeNode>> = [];
        var _this = this;
        var ancestorData = new Map();
        ancestorsRoot.eachAfter(function (node) {
            if (!node.parent) {
                return;
            }
            var descendantOptions = __assign({}, _this.options);
            descendantOptions.startFam = node.data.family.id;
            descendantOptions.startIndi = undefined;
            var child = node.id === node.parent.data.spouseParentNodeId
                ? node.parent.data.spouse.id
                : node.parent.data.indi.id;
            descendantOptions.data = new FilterChildData(descendantOptions.data, child);
            descendantOptions.baseGeneration =
                (_this.options.baseGeneration || 0) - node.depth;
            var descendantNodes = descendant_chart_1.layOutDescendants(descendantOptions);
            // The id could be modified because of duplicates. This can happen when
            // drawing one family in multiple places of the chart).
            node.data.id = descendantNodes[0].id;
            var chartInfo = chart_util_1.getChartInfoWithoutMargin(descendantNodes);
            var parentData = (node.children || []).map(function (childNode) {
                return ancestorData.get(childNode.data.id);
            });
            var parentHeight = parentData
                .map(function (data) { return data.height; })
                .reduce(function (a, b) { return a + b + chart_util_1.V_SPACING; }, 0);
            var data = {
                descendantNodes: descendantNodes,
                width: chartInfo.size[0],
                height: chartInfo.size[1] + parentHeight,
                x: chartInfo.origin[0],
                y: chartInfo.origin[1] + parentHeight,
            };
            ancestorData.set(node.data.id, data);
        });
        ancestorsRoot.each(function (node) {
            if (!node.parent) {
                return;
            }
            var data = ancestorData.get(node.data.id);
            var parentData = ancestorData.get(node.parent.data.id);
            data.left =
                parentData && !parentData.middle
                    ? parentData.left
                    : node.parent.data.indiParentNodeId === node.id;
            data.middle =
                (!parentData || parentData.middle) &&
                    node.parent.children.length === 1;
        });
        ancestorsRoot.each(function (node) {
            var data = ancestorData.get(node.data.id);
            var thisNode = data ? data.descendantNodes[0] : focusedNode;
            (node.children || []).forEach(function (child) {
                var childNode = ancestorData.get(child.data.id).descendantNodes[0];
                childNode.parent = thisNode;
            });
            if (node.data.indiParentNodeId && node.children) {
                thisNode.data.indiParentNodeId = node.children.find(function (childNode) { return childNode.id === node.data.indiParentNodeId; }).data.id;
            }
            if (node.data.spouseParentNodeId && node.children) {
                thisNode.data.spouseParentNodeId = node.children.find(function (childNode) { return childNode.id === node.data.spouseParentNodeId; }).data.id;
            }
        });
        ancestorsRoot.each(function (node) {
            var nodeData = ancestorData.get(node.data.id);
            // Lay out the nodes produced by laying out descendants of ancestors
            // instead of the ancestor nodes from ancestorsRoot.
            var thisNode = nodeData ? nodeData.descendantNodes[0] : focusedNode;
            var indiParent = node.children &&
                node.children.find(function (child) { return child.id === node.data.indiParentNodeId; });
            var spouseParent = node.children &&
                node.children.find(function (child) { return child.id === node.data.spouseParentNodeId; });
            var nodeX = thisNode.x;
            var nodeY = thisNode.y;
            var nodeWidth = thisNode.data.width;
            var nodeHeight = thisNode.data.height;
            var indiWidth = thisNode.data.indi ? thisNode.data.indi.width : 0;
            var spouseWidth = thisNode.data.spouse
                ? thisNode.data.spouse.width
                : 0;
            // Lay out the individual's ancestors and their descendants.
            if (indiParent) {
                var data = ancestorData.get(indiParent.data.id);
                var parentNode = data.descendantNodes[0];
                var parentData = parentNode.data;
                var spouseTreeHeight = spouseParent
                    ? ancestorData.get(spouseParent.data.id).height + chart_util_1.V_SPACING
                    : 0;
                var dx_1 = nodeX +
                    data.x -
                    nodeWidth / 2 +
                    indiWidth / 2 +
                    (data.left ? -data.width - chart_util_1.H_SPACING : chart_util_1.H_SPACING);
                var dy_1 = nodeY +
                    data.y -
                    nodeHeight / 2 -
                    data.height +
                    (data.left ? -chart_util_1.V_SPACING : -spouseTreeHeight - chart_util_1.V_SPACING);
                // Move all nodes by (dx, dy). The ancestor node,
                // ie. data.descendantNodes[0] is now at (0, 0).
                data.descendantNodes.forEach(function (node) {
                    node.x += dx_1;
                    node.y += dy_1;
                });
                // Set the ancestor's horizontal position independently.
                var middleX = indiWidth / 2 -
                    nodeWidth / 2 +
                    parentData.width / 2 -
                    (parentData.indi
                        ? parentData.indi.width
                        : parentData.spouse.width);
                if (data.middle) {
                    parentNode.x = 0;
                }
                else if (!nodeData || nodeData.middle) {
                    parentNode.x =
                        -nodeWidth / 2 - parentData.width / 2 + indiWidth - chart_util_1.H_SPACING / 2;
                }
                else if (data.left) {
                    parentNode.x =
                        nodeX +
                            d3_array_1.min([
                                nodeWidth / 2 -
                                    parentData.width / 2 -
                                    spouseWidth / 2 -
                                    chart_util_1.H_SPACING,
                                middleX,
                            ]);
                }
                else {
                    parentNode.x =
                        nodeX + d3_array_1.max([parentData.width / 2 - nodeWidth / 2, middleX]);
                }
            }
            // Lay out the spouse's ancestors and their descendants.
            if (spouseParent) {
                var data = ancestorData.get(spouseParent.data.id);
                var parentNode = data.descendantNodes[0];
                var parentData = parentNode.data;
                var indiTreeHeight = indiParent
                    ? ancestorData.get(indiParent.data.id).height + chart_util_1.V_SPACING
                    : 0;
                var dx_2 = nodeX +
                    data.x +
                    nodeWidth / 2 -
                    spouseWidth / 2 +
                    (data.left ? -data.width - chart_util_1.H_SPACING : chart_util_1.H_SPACING);
                var dy_2 = nodeY +
                    data.y -
                    nodeHeight / 2 -
                    data.height +
                    (data.left ? -indiTreeHeight - chart_util_1.V_SPACING : -chart_util_1.V_SPACING);
                // Move all nodes by (dx, dy). The ancestor node,
                // ie. data.descendantNodes[0] is now at (0, 0).
                data.descendantNodes.forEach(function (node) {
                    node.x += dx_2;
                    node.y += dy_2;
                });
                // Set the ancestor's horizontal position independently.
                var middleX = nodeWidth / 2 -
                    spouseWidth / 2 +
                    parentData.width / 2 -
                    (parentData.indi
                        ? parentData.indi.width
                        : parentData.spouse.width);
                if (data.middle) {
                    parentNode.x = 0;
                }
                else if (!nodeData || nodeData.middle) {
                    parentNode.x =
                        nodeWidth / 2 + parentData.width / 2 - spouseWidth + chart_util_1.H_SPACING / 2;
                }
                else if (data.left) {
                    parentNode.x =
                        nodeX + d3_array_1.min([nodeWidth / 2 - parentData.width / 2, middleX]);
                }
                else {
                    parentNode.x =
                        nodeX +
                            d3_array_1.max([
                                parentData.width / 2 - nodeWidth / 2 + indiWidth / 2 + chart_util_1.H_SPACING,
                                middleX,
                            ]);
                }
            }
        });
        return Array.from(ancestorData.values())
            .map(function (data) { return data.descendantNodes; })
            .reduce(function (a, b) { return a.concat(b); }, []);
    };
    RelativesChart.prototype.render = function () {
        var descendantNodes = descendant_chart_1.layOutDescendants(this.options);
        // Don't use common id generator because these nodes will not be drawn.
        var ancestorOptions = Object.assign({}, this.options, {
            idGenerator: undefined,
        });
        var ancestorsRoot = ancestor_chart_1.getAncestorsTree(ancestorOptions);
        var ancestorDescentants = this.layOutAncestorDescendants(ancestorsRoot, descendantNodes[0]);
        var nodes = descendantNodes.concat(ancestorDescentants);
        var animationPromise = this.util.renderChart(nodes);
        var info = chart_util_1.getChartInfo(nodes);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: animationPromise });
    };
    return RelativesChart;
}());
exports.RelativesChart = RelativesChart;
