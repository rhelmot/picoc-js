function Preprocessor(picoparent) {
    this.picoparent = picoparent;
    this.macros = {};
    this.emacros = {};

    function range_test_generator(x,y) {
        x = x.charCodeAt(0);
        y = y.charCodeAt(0);
        return function (c) {
            var i = c.charCodeAt(0);
            return i >= x && i <= y;
        }
    }
    var rtg = range_test_generator;

    var uc = {};
    uc.BIGALPHA = rtg('A','Z');
    uc.LITTLEALPHA = rtg('a','z');
    uc.ALPHA = function (c) {return uc.BIGALPHA(c) || uc.LITTLEALPHA(c);};
    uc.NUMERIC = rtg('0','9');
    uc.ALPHANUM = function (c) {return uc.ALPHA(c) || uc.NUMERIC(c);};
    uc.WHITESPACE = function (c) {return c === ' ' || c === '\n' || c === '\r' || c === '\t';};
    uc.IDENTSTART = function (c) {return c === '_' || uc.ALPHA(c);};
    uc.IDENTCONT = function (c) {return c === '_' || uc.ALPHANUM(c);};

    var hashtags = {
        IF: 0, IFDEF: 1, IFNDEF: 2, ELIF: 3, ELSE: 4, ENDIF: 5,
        INCLUDE: 6, DEFINE: 7, UNDEF: 8,
        ASSERT: -1, ERROR: -1, IDENT: -1, IMPORT: -1, INCLUDE_NEXT: -1, LINE: -1,
        PRAGMA: -1, SCCS: -1, UNASSERT: -1, WARNING: -1
    };
    
    function continue_lines(lines) {
        for (var i = lines.length - 2; i >= 0; i--) {
            if (lines[i][lines[i].length-1] == '\\') {
                lines[i] = lines[i].slice(0, -1) + lines[i+1];
                lines[i+1] = '';
            }
        }
    }

    this.preprocess = function (source) {
        var errors = [];
        var macros = this.macros;
        var emacros = this.emacros;
        function Error(d, q) {
            if (typeof d == "string") {
                errors.push({msg: d, row: 0, col: 0});
            } else {
                errors[errors.length-1].row = d;
                errors[errors.length-1].col = q;
            }
        }

        function parse_macros(lines) {
            var ifstack = [];
            // Values: 
            // 0 - Do not engage this block under any circumstances
            // 1 - Have not yet engaged this block
            // 2 - Currently engaging this block
            for (var i = 0; i < lines.length; i++) {
                if (lines[i][0] === '#') {
                    var hashtype = diagnose_hashtag(lines[i]);
                    if (hashtype < 0) {
                        Error(i + 1, 1);
                        lines[i] = '';
                        continue;
                    } else if (hashtype > hashtags.ENDIF) {
                        if (ifstack.length > 0 && ifstack[ifstack.length-1] < 2) {
                            lines[i] = '';
                            continue;
                        }
                        if (hashtype === hashtags.INCLUDE) {
                            if (!parse_include(lines[i])) {
                                Error(i + 1, 1);
                            }
                        } else if (hashtype === hashtags.DEFINE) {
                            var r = parse_define(lines[i]);
                            if (typeof r == 'number') {
                                Error(i + 1, r + 1);
                            }
                        } else if (hashtype === hashtags.UNDEF) {
                            if (!parse_undef(lines[i])) {
                                Error(i + 1, 1);
                            }
                        }
                    } else {    // this block for the #conditionals
                        if (hashtype === hashtags.ENDIF) {  // This block for #endif
                            if (ifstack.length === 0) {
                                Error("#endif ourside of conditional block");
                                Error(i+1, 1);
                            } else {
                                ifstack.pop();
                            }
                            lines[i] = '';
                            continue;
                        } else if (hashtype < hashtags.ELIF) {  // This block for #if, #ifdef, #ifndef
                            if (ifstack.length > 0 && ifstack[ifstack.length-1] < 2) {
                                ifstack.push(0);
                            } else if (evaluate_if(lines[i], hashtype)) {
                                ifstack.push(2);
                            } else {
                                ifstack.push(1);
                            }

                        } else {  // This block for #elif, #else
                            if (ifstack.length > 0 && ifstack[ifstack.length-1] !== 1) {
                                lines[i] = '';
                                ifstack[ifstack.length-1] = 0;
                                continue;
                            }
                            if (hashtype === hashtags.ELIF && !evaluate_if(lines[i], hashtype)) {
                                lines[i] = '';
                                continue;
                            }
                            ifstack[ifstack.length-1] = 2;
                        }
                    }
                    lines[i] = '';
                } else {
                    if (ifstack.length > 0 && ifstack[ifstack.length-1] < 2) {
                        lines[i] = '';
                    }
                }
            }
        }


        function evaluate_if(line, hashtype) {
            var hashes = ['#if ', '#ifdef ', '#ifndef ', '#elif '];
            var expr = line.substr(hashes[hashtype].length);
            if (hashtype === hashtags.IF || hashtype === hashtags.ELIF) {
                try {
                    with (emacros) {
                        return eval(expr);
                    }
                } catch (e) {
                    Error("Error evaluating preprocessor conditional");
                    return true;        // Attempt to find more errors
                }
            } else {
                var ident = extract_ident(line, hashes[hashtype].length);
                return (ident.ident in emacros) ^ (hashtype === hashtags.IFNDEF);
            }
        }

        function diagnose_hashtag(line) {
            var tag = '';
            for (var i = 1; i < line.length && !uc.WHITESPACE(line[i]); i++) {
                tag += line[i];
            }
            var tagu = tag.toUpperCase();
            if (tagu in hashtags) {
                tagu = hashtags[tagu];
                if (tagu === -1) {
                    Error("Unsupported preprocessor directive: '" + tag + "'");
                }
            } else {
                Error("Unknown preprocessor directive: '" + tag + "'");
                tagu = -2;
            }
            return tagu;
        }

        function extract_ident(line, start) {
            for (var i = start; i < line.length && uc.WHITESPACE(line[i]); i++);
            if (!uc.IDENTSTART(line[i])) {
                Error('Bad identifier');
                return null;
            } else {
                for (var j = i; j < line.length && uc.IDENTCONT(line[j]); j++);
                return {ident: line.slice(i, j), pos: j};
            }
        }

        function parse_undef(line) {
            var ident = extract_ident(line, '#undef '.length);
            if (ident === null) {
                return false;
            } else {
                delete macros[ident.ident];
                return true;
            }
        }

        function parse_define(line) {
            var ident = extract_ident(line, '#define '.length);
            if (ident === null) {
                return 0;
            } else if (line[ident.pos] === '(') {
                var args = [];
                while (true) {
                    var nident = extract_ident(line, ident.pos);
                    if (nident === null) return ident.pos;
                    args.push(nident.ident);
                    for (; nident.pos < line.length && uc.WHITESPACE(line[nident.pos]); nident.pos++);
                    if (nident.pos >= line.length || (line[nident.pos] !== ')' && line[nident.pos] !== ',')) {
                        Error("Expected ')' or ','");
                        return nident.pos;
                    }
                    ident.pos = nident.pos + 1;
                    if (line[nident.pos] === ')') break;
                }
                ident.pos++;
                var val = line.substr(line.pos);
                try {
                    emacros[ident.ident] = Function(args.join(','), 'return ' + val);
                } catch (e) {
                    Error("Syntax error in macro");
                    return 0; 
                }
                macros[ident.ident] = {
                    type: "macro",
                    args: args,
                    value: val
                };
            } else {
                var val = line.substr(ident.pos);
                try {
                    with (emacros) {
                        emacros[ident.ident] = eval(val);
                    }
                } catch (e) {
                    Error("Error in constant definition");
                    return 0;
                }
                macros[ident.ident] = {
                    type: "constant",
                    value: line.substr(ident.pos)
                };
            }
            return true;
        }

        function parse_include(line) {
            var i;
            for (i = '#include '.length; i < line.length && uc.WHITESPACE(line[i]); i++);
            if (i >= line.length || (line[i] !== '"' && line[i] !== '<')) {
                Error("Bad include target");
                return false;
            }
            var sysincl = line[i] === '<';
            var endchar = sysincl ? '>' : '"';
            var target = '';
            for (i++; i < line.length && line[i] !== endchar; i++) {
                target += line[i];
            }
            if (i === line.length ) {
                Error("Bad include target");
                return false;
            }
            picoparent.add(target, sysinclude);
            return true;
        }


        var out = source.replace(/\r/g, '');
        out = out.split('\n');
        continue_lines(out);
        parse_macros(out);
        if (errors.length === 0) {
            return out.join('\n');
        } else {
            return errors;
        }
    };
}


