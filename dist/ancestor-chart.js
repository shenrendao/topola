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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AncestorChart = exports.getAncestorsTree = void 0;
var chart_util_1 = require("./chart-util");
var d3_hierarchy_1 = require("d3-hierarchy");
var id_generator_1 = require("./id-generator");
function getAncestorsTree(options) {
    var ancestorChartOptions = __assign({}, options);
    var startIndiFamilies = options.startIndi
        ? options.data.getIndi(options.startIndi).getFamiliesAsSpouse()
        : [];
    // If the start individual is set and this person has at least one spouse,
    // start with the family instead.
    if (startIndiFamilies.length) {
        ancestorChartOptions.startFam = startIndiFamilies[0];
        ancestorChartOptions.startIndi = undefined;
        var fam = options.data.getFam(startIndiFamilies[0]);
        if (fam.getMother() === options.startIndi) {
            ancestorChartOptions.swapStartSpouses = true;
        }
    }
    var ancestors = new AncestorChart(ancestorChartOptions);
    var ancestorsRoot = ancestors.createHierarchy();
    // Remove spouse's ancestors if there are multiple spouses
    // to avoid showing ancestors of just one spouse.
    if (startIndiFamilies.length > 1 &&
        ancestorsRoot.children &&
        ancestorsRoot.children.length > 1) {
        ancestorsRoot.children.pop();
        ancestorsRoot.data.spouseParentNodeId = undefined;
    }
    return ancestorsRoot;
}
exports.getAncestorsTree = getAncestorsTree;
/** Renders an ancestors chart. */
var AncestorChart = /** @class */ (function () {
    function AncestorChart(options) {
        this.options = options;
        this.util = new chart_util_1.ChartUtil(options);
    }
    /** Creates a d3 hierarchy from the input data. */
    AncestorChart.prototype.createHierarchy = function () {
        var parents = [];
        var stack = [];
        var idGenerator = this.options.idGenerator || new id_generator_1.IdGenerator();
        if (this.options.startIndi) {
            var indi = this.options.data.getIndi(this.options.startIndi);
            var famc = indi.getFamilyAsChild();
            var id = famc ? idGenerator.getId(famc) : undefined;
            if (famc) {
                stack.push({
                    id: famc,
                    parentId: this.options.startIndi,
                    family: { id: famc },
                });
            }
            parents.push({
                id: this.options.startIndi,
                indi: { id: this.options.startIndi },
                indiParentNodeId: id,
            });
        }
        else {
            stack.push({
                id: idGenerator.getId(this.options.startFam),
                family: { id: this.options.startFam },
            });
        }
        while (stack.length) {
            var entry = stack.pop();
            var fam = this.options.data.getFam(entry.family.id);
            if (!fam) {
                continue;
            }
            var _a = entry.family.id === this.options.startFam &&
                this.options.swapStartSpouses
                ? [fam.getMother(), fam.getFather()]
                : [fam.getFather(), fam.getMother()], father = _a[0], mother = _a[1];
            if (!father && !mother) {
                continue;
            }
            if (mother) {
                entry.spouse = { id: mother };
                var indi = this.options.data.getIndi(mother);
                var famc = indi.getFamilyAsChild();
                if (famc) {
                    var id = idGenerator.getId(famc);
                    entry.spouseParentNodeId = id;
                    stack.push({
                        id: id,
                        parentId: entry.id,
                        family: { id: famc },
                    });
                }
            }
            if (father) {
                entry.indi = { id: father };
                var indi = this.options.data.getIndi(father);
                var famc = indi.getFamilyAsChild();
                if (famc) {
                    var id = idGenerator.getId(famc);
                    entry.indiParentNodeId = id;
                    stack.push({
                        id: id,
                        parentId: entry.id,
                        family: { id: famc },
                    });
                }
            }
            parents.push(entry);
        }
        return d3_hierarchy_1.stratify()(parents);
    };
    /**
     * Renders the tree, calling the provided renderer to draw boxes for
     * individuals.
     */
    AncestorChart.prototype.render = function () {
        var root = this.createHierarchy();
        var nodes = this.util.layOutChart(root, { flipVertically: true });
        var animationPromise = this.util.renderChart(nodes);
        var info = chart_util_1.getChartInfo(nodes);
        this.util.updateSvgDimensions(info);
        return Object.assign(info, { animationPromise: animationPromise });
    };
    return AncestorChart;
}());
exports.AncestorChart = AncestorChart;
