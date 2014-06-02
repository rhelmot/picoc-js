function Parser (picoparent) {
    this.picoparent = picoparent;

    this.parse = function (tokens) {
        var errors = [];
        function Error(msg, token) {
            errors.push('Error, ' + token.metaSource.toString() + ': ' + msg);
        }

        var curtoken = 0;
        function inc(i) {
            i = i || 1;
            curtoken += i;
        }
        function get(i) {
            i = i || 0;
            return tokens[curtoken + i];
        }

        var openTokens = [LexToken.OPENBRACKET, LexToken.LEFTSQUAREBRACKET, LexToken.LEFTBRACE];
        var closeTokens = [LexToken.CLOSEBRACKET, LexToken.RIGHTSQUAREBRACKET, LexToken.RIGHTBRACE, LexToken.SEMICOLON, LexToken.EOF];
        var literalCloseTokens = [')',']','}',';'];

        function isValue(listitem) {
            return listitem instanceof ValueNode ||
                (listitem instanceof Token && (typeof listitem.value != 'undefined') &&
                 listitem.type !== LexToken.CAST);
        }

        function forceListType(node, type) {
            if (node.operator.Enum !== type.Enum) {
                node = new ValueNode(type, [node]);
            }
            return node;
        }

        function postfixParse(endtoken) {
            var list = [];
            while (true) {
                var ttoken = get();
                inc();
                if (ttoken.type === endtoken) {
                    break;
                } else if (openTokens.indexOf(ttoken.type) >= 0) {
                    var l = makeExprTree(closeTokens[openTokens.indexOf(ttoken.type)]);
                    if (l === null) return null;
                    if (ttoken.type === LexToken.OPENBRACKET) {
                        if (isValue(list[list.length-1])) {
                            l = forceListType(l, Operators.TUPLE);
                            list[list.length-1] = new ValueNode(
                                    Operators.FUNCTIONCALL,
                                    list[list.length-1],
                                    l);
                            continue;
                        } else {
                            list.push(l);
                            continue;
                        }
                    } else if (ttoken.type === LexToken.LEFTBRACE) {
                            l = forceListType(l, Operators.ARRAY);
                            list.push(l);
                    } else if (ttoken.type === LexToken.LEFTSQUAREBRACKET) {
                        if (isValue(list[list.length-1])) {
                            list[list.length-1] = new ValueNode(
                                    Operators.SUBSCRIPT,
                                    list[list.length-1],
                                    l);
                            continue;
                        } else {
                            Error("No value to index", ttoken);
                            return null;
                        }
                    }
                } else if (closeTokens.indexOf(ttoken.type) >= 0) {
                    Error("Expected " + literalCloseTokens[closeTokens.indexOf(endtoken)], ttoken);
                    return null;
                } else if (ttoken.type === LexToken.DOT || ttoken.type === LexToken.ARROW) {
                    if (!isValue(list[list.length-1])) {
                        Error("No value to access member of", ttoken);
                        return null;
                    } else if (get().type !== LexToken.IDENTIFIER) {
                        Error("No valid identifier to use for member access", ttoken);
                        return null;
                    }
                    list[list.length-1] = new ValueNode(
                            ttoken.type === LexToken.DOT ? Operators.DOT : Operators.ARROW,
                            list[list.length-1],
                            get());
                    inc();
                    continue;
                } else if (ttoken.type === LexToken.INCREMENT || ttoken.type === LexToken.DECREMENT) {
                    if (isValue(list[list.length-1])) {
                        list[list.length-1] = new ValueNode(
                                ttoken.type === LexToken.INCREMENT ? Operators.POSTINCREMENT : Operators.POSTDECREMENT,
                                list[list.length-1]);
                        continue;
                    } else {
                        list.push(ttoken);
                        continue;
                    }
                } else if (isValue(ttoken)) {
                    list.push(new ValueNode(ttoken));
                } else {
                    list.push(ttoken);
                }
            }
            if (list.length === 0) {
                return new ValueNode(Operator.TUPLE, []);
            }
            return list;
        }

        var prefixOperators = [LexToken.PLUS, LexToken.MINUS, LexToken.ASTERISK, LexToken.AMPERSAND, LexToken.UNARYNOT, LexToken.BINARYNOT, LexToken.CAST, LexToken.SIZEOF];
        var unambiguousStart = 3;
        var correspondsToPrefixes = [Operators.POSITIVE, Operators.NEGATIVE, Operators.DEREF, Operators.ADDROF, Operators.UNARYNOT, Operators.BINARYNOT, Operators.CAST, Operators.SIZEOF];

        function prefixParse(inlist) {
            if (inlist === null) return null;
            var list = [];
            while (true) {
                var node = inlist.pop();
                if (typeof node == 'undefined') break;
                if (isValue(node)) {
                    if (isValue(list[0])) {
                        Error("No operator between values", node);
                        return null;
                    }
                    list.unshift(node);
                    continue;
                }
                if (list.length === 0) {
                    Error("Non-prefix operator at end of expression", node);
                    return null;
                }
                if (!isValue(list[0])) {
                    Error("Can't operate on operator", node);
                    return null;
                }
                var index = prefixOperators.indexOf(node.type);
                if (index < 0) {
                    list.unshift(node);
                    continue;
                }
                if (index < unambiguousStart) {
                    if (isValue(inlist[inlist.length-1])) {
                        list.unshift(node);
                        continue;
                    }
                }
                list[0] = new ValueNode(correspondsToPrefixes[index], list[0]);
            }
            return list;
        }

        var binaryOps = [LexToken.ASTERISK, LexToken.SLASH, LexToken.MODULUS, LexToken.PLUS, LexToken.MINUS, LexToken.SHIFTRIGHT, LexToken.SHIFTLEFT, LexToken.GREATERTHAN, LexToken.LESSTHAN, LexToken.GREATEREQUAL, LexToken.LESSEQUAL, LexToken.EQUAL, LexToken.NOTEQUAL, LexToken.AMPERSAND, LexToken.ARITHMETICXOR, LexToken.ARITHMETICOR, LexToken.LOGICALAND, LexToken.LOGICALOR];
        var binaryOpOps = [Operators.MULTIPLY, Operators.DIVIDE, Operators.MODULUS, Operators.ADD, Operators.SUBTRACT, Operators.GREATERTHAN, Operators.LESSTHAN, Operators.GREATERTHANEQUAL, Operators.LESSTHANEQUAL, Operators.EQUALS, Operators.NOTEQUALS, Operators.BINARYAND, Operators.XOR, Operators.BINARYOR, Operators.UNARYAND, Operators.UNARYOR];

        function binaryParse(list) {
            if (list === null) return null;
            // assert isValue(list[list.length-1]), isValue(2n), !isValue(2n+1)
            var i = 0;
            for (; i < list.length; i++) {
                if (i % 2 == 0 ^ isValue(list[i])) {
                    Error("*** CRITITCAL *** Failed binaryParse every-other assertion", list[i]);
                    return null;
                }
            }
            if (i % 2 == 0) {
                Error("*** CRITICAL *** Failed binaryParse every-other assertion", list[i-1]);
                return null;
            }
            i = 1;
            function consolidate() {
                list.splice(i-1, 3, new ValueNode(getOp(), list[i-1], list[i+1]));
                i -= 2;
            }
            function getOp(n) {
                n = n || 0;
                n *= 2;
                return binaryOpOps[binaryOps.indexOf((list[i + n] || {type: -1}).type)];
            }

            while (true) {
                if (i >= list.length) break;
                if (!getOp()) {
                    i += 2;
                    continue;
                }
                if (!getOp(1) || getOp(1).prec <= getOp().prec) {
                    consolidate();
                } else {
                    i += 2;
                    continue;
                }
            }
            return list;
        }

        function ternaryParse(list) {
            var qwaiting = 0;
            for (var i = 1; i < list.length; i+=2) {
                if (list[i].type === LexToken.QUESTIONMARK) {
                    qwaiting++;
                    continue;
                } else if (list[i].type === LexToken.COLON) {
                    if (qwaiting < 1) {
                        Error('Unbalanced ternary operators', list[i]);
                        return null;
                    }
                    list.splice(i-3, 5, new ValueNode(Operators.TERNARY, list[i-3], list[i-1], list[i+1]));
                    i -= 4;
                    qwaiting--;
                    continue;
                } else if (qwaiting) {
                    Error('Invalid operator in ternary expression', list[i]);
                    return null;
                }
            }
            if (qwaiting) {
                Error('Unbalanced ternary operators', list[list.length-1]);
                return null;
            }
            return list;
        }

        var assignOps = [LexToken.ASSIGN, LexToken.ADDASSIGN, LexToken.SUBTRACTASSIGN, LexToken.MULTIPLYASSIGN, LexToken.DIVIDEASSIGN, LexToken.MODULUSASSIGN, LexToken.SHIFTLEFTASSIGN, LexToken.SHIFTRIGHTASSIGN, LexToken.ARITHMETICANDASSIGN, LexToken.ARITHMETICORASSIGN, LexToken.ARITHMETICXORASSIGN];
        var assignOpOps = [Operators.ASSIGNMENT, Operators.ADDASSIGNMENT, Operators.SUBTRACTASSIGNMENT, Operators.MULTIPLYASSIGNMENT, Operators.DIVIDEASSIGNMENT, Operators.MODULOASSIGNMENT, Operators.SHIFTLEFTASSIGNMENT, Operators.SHIFTRIGHTASSIGNMENT, Operators.ANDASSIGNMENT, Operators.ORASSIGNMENT, Operators.XORASSIGNMENT];

        function assignParse(list) {
            if (list === null) return;
            if (list.length % 2 === 0) {
                Error("*** CRITICAL *** Failed assignParse odd-length assert", list[list.length-1]);
                return null;
            }
            for (var i = list.length - 2; i > 0; i -= 2) {
                var index = assignOps.indexOf(list[i].type);
                if (index < 0) continue;
                list.splice(i-1, 3, new ValueNode(assignOpOps[index], list[i-1], list[i+1]));
            }
            return list;
        }

        function tupleParse(list) {
            if (list === null) return;
            if (list.length === 1) return list[0];
            outlist = [];
            while (list.length > 0) {
                if (list[1] instanceof Token && list[1].type !== LexToken.COMMA) {
                    Error("*** CRITICAL *** WHY ARE THERE STILL OTHER OPERATORS", list[1]);
                    return null;
                }
                outlist.push(list[0]);
                list.splice(0, 2);
            }
            return new ValueNode(Operators.TUPLE, outlist);
        }

        function parseExpression(endtoken) {
            var list = postfixParse(endtoken);      // Do initial scanning, recurse for blocks
            if (list === null) return null;
                //TODO: Handle casts at some point @_@
            list = prefixParse(list);
            list = binaryParse(list);
            list = ternaryParse(list);
            list = assignParse(list);
            var out = tupleParse(list);
            return out;
        }

        function parseStatement() {
            return parseExpression(LexToken.SEMICOLON);
            //TODO: Add statements other than pure expressions
        }

        function parseBlock(singular) {
            var lines = [];
            if (singular) {
                lines[0] = parseStatement(LexToken.SEMICOLON);
                if (lines[0] === null) {

                }
            } else {
                while (get().type !== LexToken.EOF get().type !== LexToken.RIGHTBRACE) {
                    var cexp = parseStatement(LexToken.SEMICOLON);
                    if (cexp === null) return null;
                    expressions.push(cexp);
                }
            }

        if (errors.length === 0) {
            return {list: expressions};
        } else {
            return errors;
        }
    };
}

var Operators = {
    FUNCTIONCALL: {
        Enum: 1,
        nary: 2
    },
    SUBSCRIPT: {
        Enum: 2,
        nary: 2
    },
    DOT: {
        Enum: 3,
        nary: 2
    },
    ARROW: {
        Enum: 4,
        nary: 2
    },
    POSTINCREMENT: {
        Enum: 5,
        nary: 1
    },
    POSTDECREMENT: {
        Enum: 6,
        nary: 1
    },
    DEREF: {
        Enum: 7,
        nary: 1
    },
    ADDROF: {
        Enum: 8,
        nary: 1
    },
    POSITIVE: {
        Enum: 9,
        nary: 1
    },
    NEGATIVE: {
        Enum: 10,
        nary: 1
    },
    UNARYNOT: {
        Enum: 11,
        nary: 1
    },
    BITWISENOT: {
        Enum: 12,
        nary: 1
    },
    PREINCREMENT: {
        Enum: 13,
        nary: 1
    },
    PREDECREMENT: {
        Enum: 14,
        nary: 1
    },
    TYPECAST: {
        Enum: 15,
        nary: 1
    },
    SIZEOF: {
        Enum: 16,
        nary: 1
    },
    MULTIPLY: {
        Enum: 17,
        nary: 2,
        prec: 10
    },
    DIVIDE: {
        Enum: 18,
        nary: 2,
        prec: 10
    },
    MODULUS: {
        Enum: 19,
        nary: 2,
        prec: 10
    },
    ADD: {
        Enum: 20,
        nary: 2,
        prec: 9
    },
    SUBTRACT: {
        Enum: 21,
        nary: 2,
        prec: 9
    },
    RIGHTSHIFT: {
        Enum: 22,
        nary: 2,
        prec: 8
    },
    LEFTSHIFT: {
        Enum: 23,
        nary: 2,
        prec: 8
    },
    LESSTHAN: {
        Enum: 24,
        nary: 2,
        prec: 7
    },
    GREATERTHAN: {
        Enum: 25,
        nary: 2,
        prec: 7
    },
    LESSTHANEQUALS: {
        Enum: 26,
        nary: 2,
        prec: 7
    },
    GREATERTHANEQUALS: {
        Enum: 27,
        nary: 2,
        prec: 7
    },
    EQUALS: {
        Enum: 28,
        nary: 2,
        prec: 6
    },
    NOTEQUALS: {
        Enum: 29,
        nary: 2,
        prec: 6
    },
    BINARYAND: {
        Enum: 30,
        nary: 2,
        prec: 5
    },
    XOR: {
        Enum: 31,
        nary: 2,
        prec: 4
    },
    BINARYOR: {
        Enum: 32,
        nary: 3
    },
    UNARYAND: {
        Enum: 33,
        nary: 2,
        prec: 2
    },
    UNARYOR: {
        Enum: 34,
        nary: 2,
        prec: 1
    },
    TERNARY: {
        Enum: 35,
        nary: 3
    },
    ASSIGNMENT: {
        Enum: 36,
        nary: 2
    },
    ADDASSIGNMENT: {
        Enum: 37,
        nary: 2
    },
    SUBTRACTASSIGNMENT: {
        Enum: 38,
        nary: 2
    },
    MULTIPLYASSIGNMENT: {
        Enum: 39,
        nary: 2
    },
    DIVIDEASSIGNMENT: {
        Enum: 40,
        nary: 2
    },
    MODULOASSIGNMENT: {
        Enum: 41,
        nary: 2
    },
    RIGHTSHIFTASSIGNMENT: {
        Enum: 42,
        nary: 2
    },
    LEFTSHIFTASSIGNMENT: {
        Enum: 43,
        nary: 2
    },
    ANDASSIGNMENT: {
        Enum: 44,
        nary: 2
    },
    XORASSIGNMENT: {
        Enum: 45,
        nary: 2
    },
    ORASSIGNMENT: {
        Enum: 46,
        nary: 2
    },
    TUPLE: {
        Enum: 47,
        nary: 0
    },
    ARRAY: {
        Enum: 48,
        nary: 0
    },
    UNFINISHED: {
        Enum: 49,
        nary: 0
    }
};

function ValueNode(token, operand1, operand2, operand3) {
    if (token instanceof Token) {
        this.token = token;
        if (typeof token.value != 'undefined') {
            this.nary = 0;
            this.value = token.value;
            this.metaSource = token.metaSource;
        }
        return;
    } else {
        // Assert token.name /* nonexistant */ in Operators
        if (operand1 instanceof Token || operand1 instanceof ValueNode) {
            this.metaSource = operand1.metaSource;
        } else if (operand2 instanceof Token || operand2 instanceof ValueNode) {
            this.metaSource = operand2.metaSource;
        }
        this.nary = token.nary;
        this.operator = token;
        this.opnum = token.Enum;
        this.operand1 = operand1;
        if (this.nary < 2) return;
        this.operand2 = operand2;
        if (this.nary < 3) return;
        this.operand3 = operand3;
        return;
    }
}
