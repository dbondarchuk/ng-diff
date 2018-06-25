/***
This is part of jsdifflib v1.0. <http://snowtide.com/jsdifflib>

Copyright (c) 2007, Snowtide Informatics Systems, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

	* Redistributions of source code must retain the above copyright notice, this
		list of conditions and the following disclaimer.
	* Redistributions in binary form must reproduce the above copyright notice,
		this list of conditions and the following disclaimer in the documentation
		and/or other materials provided with the distribution.
	* Neither the name of the Snowtide Informatics Systems nor the names of its
		contributors may be used to endorse or promote products derived from this
		software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
***/
/* Author: Chas Emerick <cemerick@snowtide.com> */
__whitespace = { " ": true, "\t": true, "\n": true, "\f": true, "\r": true };

var difflib = {
    defaultJunkFunction: function (c) {
        return __whitespace.hasOwnProperty(c);
    },

    stripLinebreaks: function (str) { return str.replace(/^[\n\r]*|[\n\r]*$/g, ""); },

    stringAsLines: function (str) {
        var lfpos = str.indexOf("\n");
        var crpos = str.indexOf("\r");
        var linebreak = ((lfpos > -1 && crpos > -1) || crpos < 0) ? "\n" : "\r";

        var lines = str.split(linebreak);
        for (var i = 0; i < lines.length; i++) {
            lines[i] = difflib.stripLinebreaks(lines[i]);
        }

        return lines;
    },

    // iteration-based reduce implementation
    __reduce: function (func, list, initial) {
        if (initial != null) {
            var value = initial;
            var idx = 0;
        } else if (list) {
            var value = list[0];
            var idx = 1;
        } else {
            return null;
        }

        for (; idx < list.length; idx++) {
            value = func(value, list[idx]);
        }

        return value;
    },

    // comparison function for sorting lists of numeric tuples
    __ntuplecomp: function (a, b) {
        var mlen = Math.max(a.length, b.length);
        for (var i = 0; i < mlen; i++) {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return 1;
        }

        return a.length == b.length ? 0 : (a.length < b.length ? -1 : 1);
    },

    __calculate_ratio: function (matches, length) {
        return length ? 2.0 * matches / length : 1.0;
    },

    // returns a function that returns true if a key passed to the returned function
    // is in the dict (js object) provided to this function; replaces being able to
    // carry around dict.has_key in python...
    __isindict: function (dict) {
        return function (key) { return dict.hasOwnProperty(key); };
    },

    // replacement for python's dict.get function -- need easy default values
    __dictget: function (dict, key, defaultValue) {
        return dict.hasOwnProperty(key) ? dict[key] : defaultValue;
    },

    SequenceMatcher: function (a, b, isjunk) {
        this.set_seqs = function (a, b) {
            this.set_seq1(a);
            this.set_seq2(b);
        }

        this.set_seq1 = function (a) {
            if (a == this.a) return;
            this.a = a;
            this.matching_blocks = this.opcodes = null;
        }

        this.set_seq2 = function (b) {
            if (b == this.b) return;
            this.b = b;
            this.matching_blocks = this.opcodes = this.fullbcount = null;
            this.__chain_b();
        }

        this.__chain_b = function () {
            var b = this.b;
            var n = b.length;
            var b2j = this.b2j = {};
            var populardict = {};
            for (var i = 0; i < b.length; i++) {
                var elt = b[i];
                if (b2j.hasOwnProperty(elt)) {
                    var indices = b2j[elt];
                    if (n >= 200 && indices.length * 100 > n) {
                        populardict[elt] = 1;
                        delete b2j[elt];
                    } else {
                        indices.push(i);
                    }
                } else {
                    b2j[elt] = [i];
                }
            }

            for (var elt in populardict) {
                if (populardict.hasOwnProperty(elt)) {
                    delete b2j[elt];
                }
            }

            var isjunk = this.isjunk;
            var junkdict = {};
            if (isjunk) {
                for (var elt in populardict) {
                    if (populardict.hasOwnProperty(elt) && isjunk(elt)) {
                        junkdict[elt] = 1;
                        delete populardict[elt];
                    }
                }
                for (var elt in b2j) {
                    if (b2j.hasOwnProperty(elt) && isjunk(elt)) {
                        junkdict[elt] = 1;
                        delete b2j[elt];
                    }
                }
            }

            this.isbjunk = difflib.__isindict(junkdict);
            this.isbpopular = difflib.__isindict(populardict);
        }

        this.find_longest_match = function (alo, ahi, blo, bhi) {
            var a = this.a;
            var b = this.b;
            var b2j = this.b2j;
            var isbjunk = this.isbjunk;
            var besti = alo;
            var bestj = blo;
            var bestsize = 0;
            var j = null;

            var j2len = {};
            var nothing = [];
            for (var i = alo; i < ahi; i++) {
                var newj2len = {};
                var jdict = difflib.__dictget(b2j, a[i], nothing);
                for (var jkey in jdict) {
                    if (jdict.hasOwnProperty(jkey)) {
                        j = jdict[jkey];
                        if (j < blo) continue;
                        if (j >= bhi) break;
                        newj2len[j] = k = difflib.__dictget(j2len, j - 1, 0) + 1;
                        if (k > bestsize) {
                            besti = i - k + 1;
                            bestj = j - k + 1;
                            bestsize = k;
                        }
                    }
                }
                j2len = newj2len;
            }

            while (besti > alo && bestj > blo && !isbjunk(b[bestj - 1]) && a[besti - 1] == b[bestj - 1]) {
                besti--;
                bestj--;
                bestsize++;
            }

            while (besti + bestsize < ahi && bestj + bestsize < bhi &&
                !isbjunk(b[bestj + bestsize]) &&
                a[besti + bestsize] == b[bestj + bestsize]) {
                bestsize++;
            }

            while (besti > alo && bestj > blo && isbjunk(b[bestj - 1]) && a[besti - 1] == b[bestj - 1]) {
                besti--;
                bestj--;
                bestsize++;
            }

            while (besti + bestsize < ahi && bestj + bestsize < bhi && isbjunk(b[bestj + bestsize]) &&
                a[besti + bestsize] == b[bestj + bestsize]) {
                bestsize++;
            }

            return [besti, bestj, bestsize];
        }

        this.get_matching_blocks = function () {
            if (this.matching_blocks != null) return this.matching_blocks;
            var la = this.a.length;
            var lb = this.b.length;

            var queue = [[0, la, 0, lb]];
            var matching_blocks = [];
            var alo, ahi, blo, bhi, qi, i, j, k, x;
            while (queue.length) {
                qi = queue.pop();
                alo = qi[0];
                ahi = qi[1];
                blo = qi[2];
                bhi = qi[3];
                x = this.find_longest_match(alo, ahi, blo, bhi);
                i = x[0];
                j = x[1];
                k = x[2];

                if (k) {
                    matching_blocks.push(x);
                    if (alo < i && blo < j)
                        queue.push([alo, i, blo, j]);
                    if (i + k < ahi && j + k < bhi)
                        queue.push([i + k, ahi, j + k, bhi]);
                }
            }

            matching_blocks.sort(difflib.__ntuplecomp);

            var i1 = j1 = k1 = block = 0;
            var non_adjacent = [];
            for (var idx in matching_blocks) {
                if (matching_blocks.hasOwnProperty(idx)) {
                    block = matching_blocks[idx];
                    i2 = block[0];
                    j2 = block[1];
                    k2 = block[2];
                    if (i1 + k1 == i2 && j1 + k1 == j2) {
                        k1 += k2;
                    } else {
                        if (k1) non_adjacent.push([i1, j1, k1]);
                        i1 = i2;
                        j1 = j2;
                        k1 = k2;
                    }
                }
            }

            if (k1) non_adjacent.push([i1, j1, k1]);

            non_adjacent.push([la, lb, 0]);
            this.matching_blocks = non_adjacent;
            return this.matching_blocks;
        }

        this.get_opcodes = function () {
            if (this.opcodes != null) return this.opcodes;
            var i = 0;
            var j = 0;
            var answer = [];
            this.opcodes = answer;
            var block, ai, bj, size, tag;
            var blocks = this.get_matching_blocks();
            for (var idx in blocks) {
                if (blocks.hasOwnProperty(idx)) {
                    block = blocks[idx];
                    ai = block[0];
                    bj = block[1];
                    size = block[2];
                    tag = '';
                    if (i < ai && j < bj) {
                        tag = 'replace';
                    } else if (i < ai) {
                        tag = 'delete';
                    } else if (j < bj) {
                        tag = 'insert';
                    }
                    if (tag) answer.push([tag, i, ai, j, bj]);
                    i = ai + size;
                    j = bj + size;

                    if (size) answer.push(['equal', ai, i, bj, j]);
                }
            }

            return answer;
        }

        // this is a generator function in the python lib, which of course is not supported in javascript
        // the reimplementation builds up the grouped opcodes into a list in their entirety and returns that.
        this.get_grouped_opcodes = function (n) {
            if (!n) n = 3;
            var codes = this.get_opcodes();
            if (!codes) codes = [["equal", 0, 1, 0, 1]];
            var code, tag, i1, i2, j1, j2;
            if (codes[0][0] == 'equal') {
                code = codes[0];
                tag = code[0];
                i1 = code[1];
                i2 = code[2];
                j1 = code[3];
                j2 = code[4];
                codes[0] = [tag, Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2];
            }
            if (codes[codes.length - 1][0] == 'equal') {
                code = codes[codes.length - 1];
                tag = code[0];
                i1 = code[1];
                i2 = code[2];
                j1 = code[3];
                j2 = code[4];
                codes[codes.length - 1] = [tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)];
            }

            var nn = n + n;
            var group = [];
            var groups = [];
            for (var idx in codes) {
                if (codes.hasOwnProperty(idx)) {
                    code = codes[idx];
                    tag = code[0];
                    i1 = code[1];
                    i2 = code[2];
                    j1 = code[3];
                    j2 = code[4];
                    if (tag == 'equal' && i2 - i1 > nn) {
                        group.push([tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]);
                        groups.push(group);
                        group = [];
                        i1 = Math.max(i1, i2 - n);
                        j1 = Math.max(j1, j2 - n);
                    }

                    group.push([tag, i1, i2, j1, j2]);
                }
            }

            if (group && !(group.length == 1 && group[0][0] == 'equal')) groups.push(group)

            return groups;
        }

        this.ratio = function () {
            matches = difflib.__reduce(
                function (sum, triple) { return sum + triple[triple.length - 1]; },
                this.get_matching_blocks(), 0);
            return difflib.__calculate_ratio(matches, this.a.length + this.b.length);
        }

        this.quick_ratio = function () {
            var fullbcount, elt;
            if (this.fullbcount == null) {
                this.fullbcount = fullbcount = {};
                for (var i = 0; i < this.b.length; i++) {
                    elt = this.b[i];
                    fullbcount[elt] = difflib.__dictget(fullbcount, elt, 0) + 1;
                }
            }
            fullbcount = this.fullbcount;

            var avail = {};
            var availhas = difflib.__isindict(avail);
            var matches = numb = 0;
            for (var i = 0; i < this.a.length; i++) {
                elt = this.a[i];
                if (availhas(elt)) {
                    numb = avail[elt];
                } else {
                    numb = difflib.__dictget(fullbcount, elt, 0);
                }
                avail[elt] = numb - 1;
                if (numb > 0) matches++;
            }

            return difflib.__calculate_ratio(matches, this.a.length + this.b.length);
        }

        this.real_quick_ratio = function () {
            var la = this.a.length;
            var lb = this.b.length;
            return _calculate_ratio(Math.min(la, lb), la + lb);
        }

        this.isjunk = isjunk ? isjunk : difflib.defaultJunkFunction;
        this.a = this.b = null;
        this.set_seqs(a, b);
    }
};

/*
This is part of the ng-diff module <https://github.com/dbondarchuk/ng-diff> 
Contains lib of jsdifflib v1.0. <http://github.com/cemerick/jsdifflib>

Copyright 2018 Dmytro Bondarchuk (dmitriy.bondarchuk@outlook.com). All right reserved.

MIT License

Copyright (c) 2018 Dmitriy Bondarchuk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
angular.module('ngDiff', []).
    directive('ngDiffCompile', function ($compile) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                scope.$watch(attrs.ngDiffCompile, function (newValue, oldValue) {
                    element.html(newValue);
                    $compile(element.contents())(scope);
                });
            }
        }
    }).directive('ngDiff', ['$compile', function ($compile) {
    return {
        restrict: 'EA',
        scope: {
            left: '=',
            right: '=',
            leftTitle: '=',
            rightTitle: '=',
            contextSize: '=?',
            inline: '=',
            inlineTitleFunc: '@',
            notShowEqual: '='
        },
        template: '<table class="diff" ng-class="{\'inlinediff\': inline}" ng-show="left || right">' +
            '<thead>' +
            '<tr>' +
            '<th width="40px"></th>' +
            '<th ng-if="!inline" class="texttitle" ng-diff-compile="leftTitle"></th>' +
            '<th width="40px"></th>' +
            '<th ng-if="!inline" class="texttitle" ng-diff-compile="rightTitle"></th>' +
            '<th ng-if="inline" class="texttitle" ng-diff-compile="inlineTitleFunc()"></th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>' +
            '<tr ng-repeat="row in rows track by $index">' +
            '<th>{{row.leftIndex}}</th>' +
            '<td ng-class="row.leftClass" ng-if="!inline">{{row.left}}</th>' +
            '<th>{{row.rightIndex}}</th>' +
            '<td ng-class="row.rightClass" ng-if="!inline">{{row.right}}</th>' +
            '<td ng-class="row.inlineClass" ng-if="inline">{{row.left}}</th>' +
            '</tr>' +
            '</tbody>' +
            '</table>',
        link: function (scope, element, attrs) {
            scope.$watch('inlineTitleFunc', function (newValue, oldValue) {
                if (newValue && newValue === oldValue) return;

                if (!newValue) {
                    scope.inlineTitleFunc = function () {
                        return scope.leftTitle + ' vs ' + scope.rightTitle;
                    }
                }
            });

            scope.rows = [];

            var buildRows = function (baseTextLines, newTextLines, opcodes) {
                var contextSize = scope.contextSize;
                var inline = scope.inline ? 1 : 0;

                if (baseTextLines == null)
                    throw "Cannot build diff view; baseTextLines is not defined.";
                if (newTextLines == null)
                    throw "Cannot build diff view; newTextLines is not defined.";
                if (!opcodes)
                    throw "Cannot build diff view; opcodes is not defined.";

                var rows = [];

                function addCells(row, tidx, tend, textLines, change, right) {
                    var position = right ? 'right' : 'left';
                    if (tidx < tend) {
                        row[position + 'Index'] = (tidx + 1).toString();
                        row[position] = textLines[tidx].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0");
                        row[position + 'Class'] = change;
                        return tidx + 1;
                    } else {
                        row[position + 'Index'] = '';
                        row[position] = '';
                        row[position + 'Class'] = "empty";
                        return tidx;
                    }
                }

                function addCellsInline(row, tidx, tidx2, textLines, change) {
                    row.leftIndex = tidx == null ? "" : (tidx + 1).toString();
                    row.rightIndex = tidx2 == null ? "" : (tidx2 + 1).toString();
                    row.left = textLines[tidx != null ? tidx : tidx2].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0");
                    row.inlineClass = change;
                }

                for (var idx = 0; idx < opcodes.length; idx++) {
                    code = opcodes[idx];
                    change = code[0];
                    var b = code[1];
                    var be = code[2];
                    var n = code[3];
                    var ne = code[4];
                    var rowcnt = Math.max(be - b, ne - n);
                    var toprows = [];
                    var botrows = [];
                    for (var i = 0; i < rowcnt; i++) {
                        // jump ahead if we've alredy provided leading context or if this is the first range
                        if (contextSize &&
                            opcodes.length > 1 &&
                            ((idx > 0 && i == contextSize) || (idx == 0 && i == 0)) &&
                            change == "equal") {
                            var jump = rowcnt - ((idx == 0 ? 1 : 2) * contextSize);
                            if (jump > 1) {
                                var row = {};

                                b += jump;
                                n += jump;
                                i += jump - 1;
                                row.leftIndex = "...";
                                row.rightIndex = "...";
                                row.left = "";
                                row.right = "";
                                row.rightClass = "skip";
                                row.leftClass = "skip";
                                row.inlineClass = "skip";

                                toprows.push(row);

                                // skip last lines if they're all equal
                                if (idx + 1 === opcodes.length) {
                                    break;
                                } else {
                                    continue;
                                }
                            }
                        }

                        var topRow = {};
                        toprows.push(topRow);
                        if (inline) {
                            if (change === "insert") {
                                addCellsInline(topRow, null, n++, newTextLines, change);
                            } else if (change === "replace") {
                                var bottomRow = {};
                                botrows.push(bottomRow);
                                if (b < be) addCellsInline(topRow, b++, null, baseTextLines, "delete");
                                if (n < ne) addCellsInline(bottomRow, null, n++, newTextLines, "insert");
                            } else if (change === "delete") {
                                addCellsInline(topRow, b++, null, baseTextLines, change);
                            } else {
                                // equal
                                addCellsInline(topRow, b++, n++, baseTextLines, change);
                            }
                        } else {
                            b = addCells(topRow, b, be, baseTextLines, change, false);
                            n = addCells(topRow, n, ne, newTextLines, change, true);
                        }
                    }

                    for (var i = 0; i < toprows.length; i++) rows.push(toprows[i]);
                    for (var i = 0; i < botrows.length; i++) rows.push(botrows[i]);
                }

                return rows;
            };

            scope.contextSize = scope.contextSize || null;

            scope.$watchGroup(['left', 'right', 'leftTitle', 'rightTitle', 'contextSize'],
                function (newValues, oldValues) {
                    if (!scope.left || !scope.right || !scope.leftTitle || !scope.rightTitle || newValues === oldValues) {
                        return;
                    }

                    var leftLines = difflib.stringAsLines(scope.left);
                    var rightLines = difflib.stringAsLines(scope.right);
                    var sm = new difflib.SequenceMatcher(leftLines, rightLines),
                        opcodes = sm.get_opcodes();

                    scope.rows = buildRows(leftLines, rightLines, opcodes);

                    if (scope.notShowEqual) {
                        var rows = [];
                        for (var i = 0; i < scope.rows.length; i++) {
                            var row = scope.rows[i];
                            if (row.leftClass === 'equal' ||
                                row.rightClass === 'equal' ||
                                row.inlineClass === 'equal') {
                                continue;
                            }

                            rows.push(row);
                        }

                        scope.rows = rows;
                    }

                    //scope.leftTitleHtml = '<span>' + scope.leftTitle + '</span>';
                    //scope.rightTitleHtml = '<span>' + scope.rightTitle + '</span>';
                });
        }
    };
}]);