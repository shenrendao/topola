"use strict";
/// <reference path="parse-gedcom.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.gedcomEntriesToJson = exports.gedcomToJson = exports.getDate = void 0;
var parse_gedcom_1 = require("parse-gedcom");
/** Returns the first entry with the given tag or undefined if not found. */
function findTag(tree, tag) {
    return tree.find(function (entry) { return entry.tag === tag; });
}
/** Returns all entries with the given tag. */
function findTags(tree, tag) {
    return tree.filter(function (entry) { return entry.tag === tag; });
}
/**
 * Returns the identifier extracted from a pointer string.
 * E.g. '@I123@' -> 'I123'
 */
function pointerToId(pointer) {
    return pointer.substring(1, pointer.length - 1);
}
/** Extracts the first and last name from a GEDCOM name field. */
function extractName(name) {
    var arr = name.split('/');
    if (arr.length === 1) {
        return { firstName: arr[0].trim() };
    }
    return { firstName: arr[0].trim(), lastName: arr[1].trim() };
}
/** Maps month abbreviations used in GEDCOM to month numbers. */
var MONTHS = new Map([
    ['jan', 1],
    ['feb', 2],
    ['mar', 3],
    ['apr', 4],
    ['may', 5],
    ['jun', 6],
    ['jul', 7],
    ['aug', 8],
    ['sep', 9],
    ['oct', 10],
    ['nov', 11],
    ['dec', 12],
]);
/** Parses the GEDCOM date into the Date structure. */
function parseDate(parts) {
    if (!parts || !parts.length) {
        return undefined;
    }
    var result = {};
    // Remove parentheses if they surround the text.
    if (parts[0].startsWith('(') && parts[parts.length - 1].endsWith(')')) {
        parts[0] = parts[0].substring(1);
        var lastPart = parts[parts.length - 1];
        parts[parts.length - 1] = lastPart.substring(0, lastPart.length - 1);
    }
    var fullText = parts.join(' ');
    var firstPart = parts[0].toLowerCase();
    if (firstPart === 'cal' || firstPart === 'abt' || firstPart === 'est') {
        result.qualifier = firstPart;
        parts = parts.slice(1);
    }
    if (parts.length && parts[parts.length - 1].match(/^\d{1,4}$/)) {
        result.year = Number(parts[parts.length - 1]);
        parts = parts.slice(0, parts.length - 1);
    }
    if (parts.length) {
        var lastPart = parts[parts.length - 1].toLowerCase();
        if (MONTHS.has(lastPart)) {
            result.month = MONTHS.get(lastPart);
            parts = parts.slice(0, parts.length - 1);
        }
    }
    if (parts.length && parts[0].match(/^\d\d?$/)) {
        result.day = Number(parts[0]);
        parts = parts.slice(0, parts.length - 1);
    }
    if (parts.length) {
        // A part didn't get parsed. Return the whole text verbatim.
        return { text: fullText };
    }
    return result;
}
/** Parses a GEDCOM date or date range. */
function getDate(gedcomDate) {
    var parts = gedcomDate.replace(/@.*@/, '').trim().split(' ');
    var firstPart = parts[0].toLowerCase();
    if (firstPart.startsWith('bet')) {
        var i = parts.findIndex(function (x) { return x.toLowerCase() === 'and'; });
        var from = parseDate(parts.slice(1, i));
        var to = parseDate(parts.slice(i + 1));
        return { dateRange: { from: from, to: to } };
    }
    if (firstPart.startsWith('bef') || firstPart.startsWith('aft')) {
        var date_1 = parseDate(parts.slice(1));
        if (firstPart.startsWith('bef')) {
            return { dateRange: { to: date_1 } };
        }
        return { dateRange: { from: date_1 } };
    }
    var date = parseDate(parts);
    if (date) {
        return { date: date };
    }
    return undefined;
}
exports.getDate = getDate;
/**
 * tries to treat an input tag as NOTE and parsse all lines of notes
 */
function createNotes(notesTag) {
    if (!notesTag || notesTag.tag !== 'NOTE')
        return undefined;
    return findTags(notesTag.tree, 'CONT')
        .filter(function (x) { return x.data; })
        .reduce(function (a, i) { return a.concat(i.data); }, [notesTag.data]);
}
/**
 * Creates a JsonEvent object from a GEDCOM entry.
 * Used for BIRT, DEAT and MARR tags.
 */
function createEvent(entry) {
    if (!entry) {
        return undefined;
    }
    var typeTag = findTag(entry.tree, 'TYPE');
    var dateTag = findTag(entry.tree, 'DATE');
    var placeTag = findTag(entry.tree, 'PLAC');
    var date = dateTag && dateTag.data && getDate(dateTag.data);
    var place = placeTag && placeTag.data;
    if (date || place) {
        var result = date || {};
        if (place) {
            result.place = place;
        }
        result.confirmed = true;
        result.type = typeTag ? typeTag.data : undefined;
        result.notes = createNotes(findTag(entry.tree, 'NOTE'));
        return result;
    }
    if (entry.data && entry.data.toLowerCase() === 'y') {
        return { confirmed: true };
    }
    return undefined;
}
/** Creates a JsonIndi object from an INDI entry in GEDCOM. */
function createIndi(entry, objects) {
    var id = pointerToId(entry.pointer);
    var fams = findTags(entry.tree, 'FAMS').map(function (entry) {
        return pointerToId(entry.data);
    });
    var indi = { id: id, fams: fams };
    // Name.
    var nameTags = findTags(entry.tree, 'NAME');
    var isMaiden = function (nameTag) {
        var type = findTag(nameTag.tree, 'TYPE');
        return type !== undefined && type.data === 'maiden';
    };
    var main = nameTags.find(function (x) { return !isMaiden(x); });
    var maiden = nameTags.find(isMaiden);
    if (main) {
        var _a = extractName(main.data), firstName = _a.firstName, lastName = _a.lastName;
        if (firstName) {
            indi.firstName = firstName;
        }
        if (lastName) {
            indi.lastName = lastName;
        }
    }
    if (maiden) {
        var _b = extractName(maiden.data), firstName = _b.firstName, lastName = _b.lastName;
        if (lastName) {
            indi.maidenName = lastName;
        }
        if (firstName && !indi.firstName) {
            indi.firstName = firstName;
        }
    }
    // Number of children.
    var nchiTag = findTag(entry.tree, 'NCHI');
    if (nchiTag) {
        indi.numberOfChildren = +nchiTag.data;
    }
    // Number of marriages.
    var nmrTag = findTag(entry.tree, 'NMR');
    if (nmrTag) {
        indi.numberOfMarriages = +nmrTag.data;
    }
    // Sex.
    var sexTag = findTag(entry.tree, 'SEX');
    if (sexTag) {
        indi.sex = sexTag.data;
    }
    // Family with parents.
    var famcTag = findTag(entry.tree, 'FAMC');
    if (famcTag) {
        indi.famc = pointerToId(famcTag.data);
    }
    // Image URL.
    var objeTags = findTags(entry.tree, 'OBJE');
    if (objeTags.length > 0) {
        // Dereference OBJEct if needed.
        var getFileTag = function (tag) {
            var realObjeTag = tag.data ? objects.get(pointerToId(tag.data)) : tag;
            if (!realObjeTag)
                return undefined;
            var file = findTag(realObjeTag.tree, 'FILE');
            var title = findTag(realObjeTag.tree, 'TITL');
            if (!file)
                return undefined;
            return {
                url: file.data,
                title: title && title.data,
            };
        };
        indi.images = objeTags
            .map(getFileTag)
            .filter(function (x) { return x !== undefined; });
    }
    // Birth date and place.
    var birth = createEvent(findTag(entry.tree, 'BIRT'));
    if (birth) {
        indi.birth = birth;
    }
    // Death date and place.
    var death = createEvent(findTag(entry.tree, 'DEAT'));
    if (death) {
        indi.death = death;
    }
    // Notes.
    indi.notes = createNotes(findTag(entry.tree, 'NOTE'));
    // Events
    indi.events = findTags(entry.tree, 'EVEN')
        .map(createEvent)
        .filter(function (x) { return x !== null; });
    return indi;
}
/** Creates a JsonFam object from an FAM entry in GEDCOM. */
function createFam(entry) {
    var id = pointerToId(entry.pointer);
    var children = findTags(entry.tree, 'CHIL').map(function (entry) {
        return pointerToId(entry.data);
    });
    var fam = { id: id, children: children };
    // Husband.
    var husbTag = findTag(entry.tree, 'HUSB');
    if (husbTag) {
        fam.husb = pointerToId(husbTag.data);
    }
    // Wife.
    var wifeTag = findTag(entry.tree, 'WIFE');
    if (wifeTag) {
        fam.wife = pointerToId(wifeTag.data);
    }
    // Marriage
    var marriage = createEvent(findTag(entry.tree, 'MARR'));
    if (marriage) {
        fam.marriage = marriage;
    }
    return fam;
}
/** Creates a map from ID to entry from an array of entries. */
function createMap(entries) {
    return new Map(entries.map(function (entry) { return [pointerToId(entry.pointer), entry]; }));
}
/** Parses a GEDCOM file into a JsonGedcomData structure. */
function gedcomToJson(gedcomContents) {
    return gedcomEntriesToJson(parse_gedcom_1.parse(gedcomContents));
}
exports.gedcomToJson = gedcomToJson;
/** Converts parsed GEDCOM entries into a JsonGedcomData structure. */
function gedcomEntriesToJson(gedcom) {
    var objects = createMap(findTags(gedcom, 'OBJE'));
    var indis = findTags(gedcom, 'INDI').map(function (entry) {
        return createIndi(entry, objects);
    });
    var fams = findTags(gedcom, 'FAM').map(createFam);
    return { indis: indis, fams: fams };
}
exports.gedcomEntriesToJson = gedcomEntriesToJson;
