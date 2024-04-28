"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetailedRenderer = exports.getLength = void 0;
var d3_selection_1 = require("d3-selection");
var _1 = require(".");
var date_format_1 = require("./date-format");
var d3_array_1 = require("d3-array");
require("d3-transition");
var composite_renderer_1 = require("./composite-renderer");
var INDI_MIN_HEIGHT = 44;
var INDI_MIN_WIDTH = 64;
var FAM_MIN_HEIGHT = 10;
var FAM_MIN_WIDTH = 15;
var IMAGE_WIDTH = 70;
/** Minimum box height when an image is present. */
var IMAGE_HEIGHT = 90;
var DETAILS_HEIGHT = 14;
var ANIMATION_DELAY_MS = 200;
var ANIMATION_DURATION_MS = 500;
var textLengthCache = new Map();
/** Calculates the length of the given text in pixels when rendered. */
function getLength(text, textClass) {
    var cacheKey = text + "|" + textClass;
    if (textLengthCache.has(cacheKey)) {
        return textLengthCache.get(cacheKey);
    }
    var g = d3_selection_1.select('svg').append('g').attr('class', 'detailed node');
    var x = g.append('text').attr('class', textClass).text(text);
    var length = x.node().getComputedTextLength();
    g.remove();
    textLengthCache.set(cacheKey, length);
    return length;
}
exports.getLength = getLength;
var SEX_SYMBOLS = new Map([
    ['F', '\u2640'],
    ['M', '\u2642'],
]);
/**
 * Renders some details about a person such as date and place of birth
 * and death.
 */
var DetailedRenderer = /** @class */ (function (_super) {
    __extends(DetailedRenderer, _super);
    function DetailedRenderer(options) {
        var _this = _super.call(this, options) || this;
        _this.options = options;
        return _this;
    }
    DetailedRenderer.prototype.getColoringClass = function () {
        switch (this.options.colors) {
            case _1.ChartColors.NO_COLOR:
                return 'nocolor';
            case _1.ChartColors.COLOR_BY_SEX:
                return 'bysex';
            default:
                return 'bygeneration';
        }
    };
    /** Extracts lines of details for a person. */
    DetailedRenderer.prototype.getIndiDetails = function (indi) {
        var detailsList = [];
        var birthDate = indi.getBirthDate() &&
            date_format_1.formatDateOrRange(indi.getBirthDate(), this.options.locale);
        var birthPlace = indi.getBirthPlace();
        var deathDate = indi.getDeathDate() &&
            date_format_1.formatDateOrRange(indi.getDeathDate(), this.options.locale);
        var deathPlace = indi.getDeathPlace();
        if (birthDate) {
            detailsList.push({ symbol: '', text: birthDate });
        }
        if (birthPlace) {
            detailsList.push({ symbol: '', text: birthPlace });
        }
        if (birthDate || birthPlace) {
            detailsList[0].symbol = '*';
        }
        var listIndex = detailsList.length;
        if (deathDate) {
            detailsList.push({ symbol: '', text: deathDate });
        }
        if (deathPlace) {
            detailsList.push({ symbol: '', text: deathPlace });
        }
        if (deathDate || deathPlace) {
            detailsList[listIndex].symbol = '+';
        }
        else if (indi.isConfirmedDeath()) {
            detailsList.push({ symbol: '+', text: '' });
        }
        return detailsList;
    };
    /** Extracts lines of details for a family. */
    DetailedRenderer.prototype.getFamDetails = function (fam) {
        var detailsList = [];
        var marriageDate = fam.getMarriageDate() &&
            date_format_1.formatDateOrRange(fam.getMarriageDate(), this.options.locale);
        var marriagePlace = fam.getMarriagePlace();
        if (marriageDate) {
            detailsList.push({ symbol: '', text: marriageDate });
        }
        if (marriagePlace) {
            detailsList.push({ symbol: '', text: marriagePlace });
        }
        if (marriageDate || marriagePlace) {
            detailsList[0].symbol = '\u26AD';
        }
        return detailsList;
    };
    DetailedRenderer.prototype.getPreferredIndiSize = function (id) {
        var indi = this.options.data.getIndi(id);
        var details = this.getIndiDetails(indi);
        var idAndSexHeight = indi.showId() || indi.showSex() ? DETAILS_HEIGHT : 0;
        var height = d3_array_1.max([
            INDI_MIN_HEIGHT + details.length * DETAILS_HEIGHT + idAndSexHeight,
            indi.getImageUrl() ? IMAGE_HEIGHT : 0,
        ]);
        var maxDetailsWidth = d3_array_1.max(details.map(function (x) { return getLength(x.text, 'details'); }));
        var width = d3_array_1.max([
            maxDetailsWidth + 22,
            getLength(indi.getFirstName() || '', 'name') + 8,
            getLength(indi.getLastName() || '', 'name') + 8,
            getLength(id, 'id') + 32,
            INDI_MIN_WIDTH,
        ]) + (indi.getImageUrl() ? IMAGE_WIDTH : 0);
        return [width, height];
    };
    DetailedRenderer.prototype.getPreferredFamSize = function (id) {
        var fam = this.options.data.getFam(id);
        var details = this.getFamDetails(fam);
        var height = d3_array_1.max([10 + details.length * DETAILS_HEIGHT, FAM_MIN_HEIGHT]);
        var maxDetailsWidth = d3_array_1.max(details.map(function (x) { return getLength(x.text, 'details'); }));
        var width = d3_array_1.max([maxDetailsWidth + 22, FAM_MIN_WIDTH]);
        return [width, height];
    };
    DetailedRenderer.prototype.render = function (enter, update) {
        var _this = this;
        enter = enter.append('g').attr('class', 'detailed');
        update = update.select('g');
        var indiUpdate = enter
            .merge(update)
            .selectAll('g.indi')
            .data(function (node) {
            var result = [];
            var famXOffset = !_this.options.horizontal && node.data.family
                ? d3_array_1.max([-composite_renderer_1.getFamPositionVertical(node.data), 0])
                : 0;
            var famYOffset = _this.options.horizontal && node.data.family
                ? d3_array_1.max([-composite_renderer_1.getFamPositionHorizontal(node.data), 0])
                : 0;
            if (node.data.indi) {
                result.push({
                    indi: node.data.indi,
                    generation: node.data.generation,
                    xOffset: famXOffset,
                    yOffset: 0,
                });
            }
            if (node.data.spouse) {
                result.push({
                    indi: node.data.spouse,
                    generation: node.data.generation,
                    xOffset: !_this.options.horizontal && node.data.indi
                        ? node.data.indi.width + famXOffset
                        : 0,
                    yOffset: _this.options.horizontal && node.data.indi
                        ? node.data.indi.height + famYOffset
                        : 0,
                });
            }
            return result;
        }, function (data) { return data.indi.id; });
        var indiEnter = indiUpdate
            .enter()
            .append('g')
            .attr('class', 'indi');
        this.transition(indiEnter.merge(indiUpdate)).attr('transform', function (node) { return "translate(" + node.xOffset + ", " + node.yOffset + ")"; });
        this.renderIndi(indiEnter, indiUpdate);
        var familyEnter = enter
            .select(function (node) {
            return node.data.family ? this : null;
        })
            .append('g')
            .attr('class', 'family');
        var familyUpdate = update
            .select(function (node) {
            return node.data.family ? this : null;
        })
            .select('g.family');
        this.transition(familyEnter.merge(familyUpdate)).attr('transform', function (node) {
            return _this.getFamTransform(node.data);
        });
        this.renderFamily(familyEnter, familyUpdate);
    };
    DetailedRenderer.prototype.getCss = function () {
        return "\n.detailed text {\n  font-family: verdana, arial, sans-serif;\n  font-size: 12px;\n}\n\n.detailed .name {\n  font-weight: bold;\n}\n\n.link {\n  fill: none;\n  stroke: #000;\n  stroke-width: 1px;\n}\n\n.additional-marriage {\n  stroke-dasharray: 2;\n}\n\n.detailed rect {\n  stroke: black;\n}\n\n.detailed {\n  stroke-width: 2px;\n}\n\n.detailed .details {\n  font-size: 10px;\n}\n\n.detailed .id {\n  font-size: 10px;\n  font-style: italic;\n}\n\n.detailed rect.nocolor {\n  fill: #ffffff;\n}\n\n.detailed rect.bysex {\n  fill: #eeeeee;\n}\n\n.detailed rect.bysex.male {\n  fill: #dbffff;\n}\n\n.detailed rect.bysex.female {\n  fill: #ffdbed;\n}\n\n.detailed rect.bygeneration {\n  fill: #ffffdd;\n}\n\n.generation-11 .detailed rect.bygeneration, .generation1 .detailed rect.bygeneration {\n  fill: #edffdb;\n}\n\n.generation-10 .detailed rect.bygeneration, .generation2 .detailed rect.bygeneration {\n  fill: #dbffdb;\n}\n\n.generation-9 .detailed rect.bygeneration, .generation3 .detailed rect.bygeneration {\n  fill: #dbffed;\n}\n\n.generation-8 .detailed rect.bygeneration, .generation4 .detailed rect.bygeneration {\n  fill: #dbffff;\n}\n\n.generation-7 .detailed rect.bygeneration, .generation5 .detailed rect.bygeneration {\n  fill: #dbedff;\n}\n\n.generation-6 .detailed rect.bygeneration, .generation6 .detailed rect.bygeneration {\n  fill: #dbdbff;\n}\n\n.generation-5 .detailed rect.bygeneration, .generation7 .detailed rect.bygeneration {\n  fill: #eddbff;\n}\n\n.generation-4 .detailed rect.bygeneration, .generation8 .detailed rect.bygeneration {\n  fill: #ffdbff;\n}\n\n.generation-3 .detailed rect.bygeneration, .generation9 .detailed rect.bygeneration {\n  fill: #ffdbed;\n}\n\n.generation-2 .detailed rect.bygeneration, .generation10 .detailed rect.bygeneration {\n  fill: #ffdbdb;\n}\n\n.generation-1 .detailed rect.bygeneration, .generation11 .detailed rect.bygeneration {\n  fill: #ffeddb;\n}";
    };
    DetailedRenderer.prototype.transition = function (selection) {
        return this.options.animate
            ? selection
                .transition()
                .delay(ANIMATION_DELAY_MS)
                .duration(ANIMATION_DURATION_MS)
            : selection;
    };
    DetailedRenderer.prototype.getFamTransform = function (node) {
        if (this.options.horizontal) {
            return "translate(" + ((node.indi && node.indi.width) || node.spouse.width) + ", " + d3_array_1.max([composite_renderer_1.getFamPositionHorizontal(node), 0]) + ")";
        }
        return "translate(" + d3_array_1.max([composite_renderer_1.getFamPositionVertical(node), 0]) + ", " + ((node.indi && node.indi.height) || node.spouse.height) + ")";
    };
    DetailedRenderer.prototype.getSexClass = function (indiId) {
        var _a;
        var sex = (_a = this.options.data.getIndi(indiId)) === null || _a === void 0 ? void 0 : _a.getSex();
        switch (sex) {
            case 'M':
                return 'male';
            case 'F':
                return 'female';
            default:
                return '';
        }
    };
    DetailedRenderer.prototype.renderIndi = function (enter, update) {
        var _this = this;
        if (this.options.indiHrefFunc) {
            enter = enter
                .append('a')
                .attr('href', function (data) { return _this.options.indiHrefFunc(data.indi.id); });
            update = update.select('a');
        }
        if (this.options.indiCallback) {
            enter.on('click', function (event, data) {
                return _this.options.indiCallback({
                    id: data.indi.id,
                    generation: data.generation,
                });
            });
        }
        // Background.
        var background = enter
            .append('rect')
            .attr('rx', 5)
            .attr('stroke-width', 0)
            .attr('class', function (node) {
            return "background " + _this.getColoringClass() + " " + _this.getSexClass(node.indi.id);
        })
            .merge(update.select('rect.background'));
        this.transition(background)
            .attr('width', function (node) { return node.indi.width; })
            .attr('height', function (node) { return node.indi.height; });
        // Clip path.
        var getClipId = function (id) { return "clip-" + id; };
        enter
            .append('clipPath')
            .attr('id', function (node) { return getClipId(node.indi.id); })
            .append('rect')
            .attr('rx', 5)
            .merge(update.select('clipPath rect'))
            .attr('width', function (node) { return node.indi.width; })
            .attr('height', function (node) { return node.indi.height; });
        var getIndi = function (data) {
            return _this.options.data.getIndi(data.indi.id);
        };
        var getDetailsWidth = function (data) {
            return data.indi.width - (getIndi(data).getImageUrl() ? IMAGE_WIDTH : 0);
        };
        // Name.
        enter
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('class', 'name')
            .attr('transform', function (node) { return "translate(" + getDetailsWidth(node) / 2 + ", 17)"; })
            .text(function (node) { return getIndi(node).getFirstName(); });
        enter
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('class', 'name')
            .attr('transform', function (node) { return "translate(" + getDetailsWidth(node) / 2 + ", 33)"; })
            .text(function (node) { return getIndi(node).getLastName(); });
        // Extract details.
        var details = new Map();
        enter.each(function (node) {
            var indi = getIndi(node);
            var detailsList = _this.getIndiDetails(indi);
            details.set(node.indi.id, detailsList);
        });
        var maxDetails = d3_array_1.max(Array.from(details.values(), function (v) { return v.length; }));
        var _loop_1 = function (i) {
            var lineGroup = enter.filter(function (data) { return details.get(data.indi.id).length > i; });
            lineGroup
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('class', 'details')
                .attr('transform', "translate(9, " + (49 + i * DETAILS_HEIGHT) + ")")
                .text(function (data) { return details.get(data.indi.id)[i].symbol; });
            lineGroup
                .append('text')
                .attr('class', 'details')
                .attr('transform', "translate(15, " + (49 + i * DETAILS_HEIGHT) + ")")
                .text(function (data) { return details.get(data.indi.id)[i].text; });
        };
        // Render details.
        for (var i = 0; i < maxDetails; ++i) {
            _loop_1(i);
        }
        // Render id.
        var id = enter
            .append('text')
            .attr('class', 'id')
            .text(function (data) { return (getIndi(data).showId() ? data.indi.id : ''); })
            .merge(update.select('text.id'));
        this.transition(id).attr('transform', function (data) { return "translate(9, " + (data.indi.height - 5) + ")"; });
        // Render sex.
        var sex = enter
            .append('text')
            .attr('class', 'details sex')
            .attr('text-anchor', 'end')
            .text(function (data) {
            var sexSymbol = SEX_SYMBOLS.get(getIndi(data).getSex() || '') || '';
            return getIndi(data).showSex() ? sexSymbol : '';
        })
            .merge(update.select('text.sex'));
        this.transition(sex).attr('transform', function (data) {
            return "translate(" + (getDetailsWidth(data) - 5) + ", " + (data.indi.height - 5) + ")";
        });
        // Image.
        enter
            .filter(function (data) { return !!getIndi(data).getImageUrl(); })
            .append('image')
            .attr('width', IMAGE_WIDTH)
            .attr('height', function (data) { return data.indi.height; })
            .attr('preserveAspectRatio', 'xMidYMin')
            .attr('transform', function (data) { return "translate(" + (data.indi.width - IMAGE_WIDTH) + ", 0)"; })
            .attr('clip-path', function (data) { return "url(#" + getClipId(data.indi.id) + ")"; })
            .attr('href', function (data) { return getIndi(data).getImageUrl(); });
        // Border on top.
        var border = enter
            .append('rect')
            .attr('rx', 5)
            .attr('fill-opacity', 0)
            .attr('class', 'border')
            .merge(update.select('rect.border'));
        this.transition(border)
            .attr('width', function (data) { return data.indi.width; })
            .attr('height', function (data) { return data.indi.height; });
    };
    DetailedRenderer.prototype.renderFamily = function (enter, update) {
        var _this = this;
        if (this.options.famHrefFunc) {
            enter = enter
                .append('a')
                .attr('href', function (node) {
                return _this.options.famHrefFunc(node.data.family.id);
            });
        }
        if (this.options.famCallback) {
            enter.on('click', function (event, node) {
                return _this.options.famCallback({
                    id: node.data.family.id,
                    generation: node.data.generation,
                });
            });
        }
        // Extract details.
        var details = new Map();
        enter.each(function (node) {
            var famId = node.data.family.id;
            var fam = _this.options.data.getFam(famId);
            var detailsList = _this.getFamDetails(fam);
            details.set(famId, detailsList);
        });
        var maxDetails = d3_array_1.max(Array.from(details.values(), function (v) { return v.length; }));
        // Box.
        enter
            .filter(function (node) {
            var detail = details.get(node.data.family.id);
            return 0 < detail.length;
        })
            .append('rect')
            .attr('class', this.getColoringClass())
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('width', function (node) { return node.data.family.width; })
            .attr('height', function (node) { return node.data.family.height; });
        var _loop_2 = function (i) {
            var lineGroup = enter.filter(function (node) { return details.get(node.data.family.id).length > i; });
            lineGroup
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('class', 'details')
                .attr('transform', "translate(9, " + (16 + i * DETAILS_HEIGHT) + ")")
                .text(function (node) { return details.get(node.data.family.id)[i].symbol; });
            lineGroup
                .append('text')
                .attr('text-anchor', 'start')
                .attr('class', 'details')
                .attr('transform', "translate(15, " + (16 + i * DETAILS_HEIGHT) + ")")
                .text(function (node) { return details.get(node.data.family.id)[i].text; });
        };
        // Render details.
        for (var i = 0; i < maxDetails; ++i) {
            _loop_2(i);
        }
    };
    return DetailedRenderer;
}(composite_renderer_1.CompositeRenderer));
exports.DetailedRenderer = DetailedRenderer;
