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
            if (node.opnum !== type.Enum) {
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
                    var l = parseExpression(closeTokens[openTokens.indexOf(ttoken.type)]);
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
        var binaryOpOps = [Operators.MULTIPLY, Operators.DIVIDE, Operators.MODULUS, Operators.ADD, Operators.SUBTRACT, Operators.RIGHTSHIFT, Operators.LEFTSHIFT, Operators.GREATERTHAN, Operators.LESSTHAN, Operators.GREATERTHANEQUALS, Operators.LESSTHANEQUALS, Operators.EQUALS, Operators.NOTEQUALS, Operators.BINARYAND, Operators.XOR, Operators.BINARYOR, Operators.UNARYAND, Operators.UNARYOR];

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

        function parseDeclaration(parentBlock) {
            var type = parseBasicType(get, inc, parentBlock);
            if (type === null) { // TODO: Less pissy error message :P
                Error("Types isn't happy at you", get());
                return null;
            }
            var expr = parseExpression(LexToken.SEMICOLON);
            if (expr === null) return null;
            if (expr.nary === 0) {
                if (expr.opnum === Operators.TUPLE.Enum) {
                    for (var i = 0; i < expr.operand1.length; i++) {
                        var sexpr = expr.operand1[i];
                        var m = sortLvalType(type, sexpr, parentBlock);
                        if (m === null) {
                            Error("Types still isn't happy with you", sexpr);
                            return null;
                        } else if (typeof m == 'string') {
                            Error(m, sexpr);
                            return null;
                        }
                        expr.operand1[i] = m;
                    }
                }
            } else {
                var m = sortLvalType(type, expr, parentBlock);
                if (m === null) {
                    Error("Types still isn't happy with you", sexpr);
                    return null;
                } else if (typeof m == 'string') {
                    Error(m, expr);
                    return null;
                }
                expr = m;
            }
            return new Statement(Statements.DECLARATION, type, expr);
        }

        function parseStatement(parentBlock) {
            switch ((get() || {}).type) {
            case undefined:
                Error("**** CRITICAL *** How'd an undefined end up in the input stream?", get(-1));
                return null;
            case LexToken.EOF:
                Error("Unexpected end of file", get());
                return null;
            case LexToken.IDENTIFIER:
                // Might be a typedef-typed variable declarataion
                // Or could be an expression
                var firstVar = parentBlock.resolveVar(get().value);
                if (firstVar) {
                    if (firstVar.type.baseType === BaseTypes.TYPE) {
                        return parseDeclaration(parentBlock);
                    }
                } else {
                    // Though it might be a goto label
                    if ((get(1) || {}).type === LexToken.COLON) {
                        parentBlock.registerLabel(get().value);
                        inc(2);
                        return true;
                    }
                }
                // Fall through to expression parsing!

            case LexToken.ASTERISK:
            case LexToken.AMPERSAND:
            case LexToken.INCREMENT:
            case LexToken.DECREMENT:
            case LexToken.OPENBRACKET:
                var exp = parseExpression(LexToken.SEMICOLON);
                if (exp === null) return null;
                else return new Statement(Statements.EXPRESSION, exp);

            case LexToken.LEFTBRACE:
                var block = parseBlock(parentBlock, BlockTypes.WHATEVER);
                if (block === null) return null;
                else return new Statement(Statements.WHATEVERBLOCK, block);

            case LexToken.IF:
                var conditions = [];
                var blocks = [];
                inc();
                if ((get() || {}).type !== LexToken.OPENBRACKET) {
                    Error("'(' expected", get(-1));
                    return null;
                }
                inc();    // Handle if() body
                conditions[0] = parseExpression(LexToken.CLOSEBRACKET);
                if (conditions[0] === null) return null;
                blocks[0] = parseBlock(parentBlock, BlockTypes.IF);
                if (blocks[0] === null) return null;
                while ((get() || {}).type === LexToken.ELSE && (get() || {}).type === LexToken.IF) {
                    inc();
                    inc();
                    if ((get() || {}).type !== LexToken.OPENBRACKET) {
                        Error("'(' expected", get(-1));
                        return null;
                    }
                    inc();        // Handle else if() bodies
                    conditions.push(parseExpression(LexToken.CLOSEBRACKET));
                    if (conditions[conditions.length-1] === null) return null;
                    blocks.push(parseBlock(parentBlock, BlockTypes.IF));
                    if (blocks[blocks.length-1] === null) return null;
                }
                if ((get() || {}).type === LexToken.ELSE) {
                    inc();        // Handle else body
                    conditions.push(true);
                    blocks.push(parseBlock(parentBlock, BlockTypes.IF));
                    if (blocks[blocks.length-1] === null) return null;
                }
                return new Statement(Statements.IF, conditions, blocks);

            case LexToken.WHILE:
                inc();
                if ((get() || {}).type !== LexToken.OPENBRACKET) {
                    Error("'(' expected", get(-1));
                    return null;
                }
                inc();
                var condition = parseExpression(LexToken.CLOSEBRACKET);
                if (condition === null) return null;
                var block = parseBlock(parentBlock, BlockTypes.WHILE);
                if (block === null) return null;
                return new Statement(Statements.WHILE, false, condition, block);

            case LexToken.DO:
                inc();
                var block = parseBlock(parentBlock, BlockTypes.WHILE);
                if (block === null) return null;
                if ((get() || {}).type !== LexToken.OPENBRACKET) {
                    Error("'(' expected", get(-1));
                    return null;
                }
                var condition = parseExpression(LexToken.SEMICOLON);
                if (condition === null) return null;
                return new Statement(Statements.WHILE, false, condition, block);

            case LexToken.FOR:
                inc();
                if ((get() || {}).type !== LexToken.OPENBRACKET) {
                    Error("'(' expected", get(-1));
                    return null;
                }
                inc();
                var ex1 = parseExpression(LexToken.SEMICOLON);
                if (ex1 === null) return null;
                var ex2 = parseExpression(LexToken.SEMICOLON);
                if (ex2 === null) return null;
                var ex3 = parseExpression(LexToken.CLOSEBRACKET);
                if (ex3 === null) return null;
                var block = parseBlock(parentBlock, BlockTypes.FOR);
                if (block === null) return null;
                return new Statement(Statements.FOR, ex1, ex2, ex3, block);

            case LexToken.INTTYPE:
            case LexToken.SHORTTYPE:
            case LexToken.CHARTYPE:
            case LexToken.LONGTYPE:
            case LexToken.FLOATTYPE:
            case LexToken.DOUBLETYPE:
            case LexToken.VOIDTYPE:
            case LexToken.STRUCTTYPE:
            case LexToken.UNIONTYPE:
            case LexToken.ENUMTYPE:
            case LexToken.SIGNEDTYPE:
            case LexToken.UNSIGNEDTYPE:
            case LexToken.STATICTYPE:
            case LexToken.AUTOTYPE:
            case LexToken.REGISTERTYPE:
            case LexToken.EXTERNTYPE:
                return parseDeclaration(parentBlock);

            case LexToken.SWITCH:
                inc();
                if ((get() || {}).type !== LexToken.OPENBRACKET) {
                    Error("'(' expected", get(-1));
                    return null;
                }
                inc();
                var condition = parseExpression(LexToken.CLOSEBRACKET);
                if (condition === null) return null;
                var block = parseBlock(parentBlock, BlockTypes.SWITCH);
                if (block === null) return null;
                return new Statement(Statements.SWITCH, condition, block);

            case LexToken.CASE:     // Getting super meta up in here
                inc();
                var tok = get() || {};
                if (tok.type !== LexToken.INTEGERCONSTANT && tok.type !== LexToken.FPCONSTANT && tok.type !== LexToken.CHARACTERCONSTANT) {
                    Error("Expected integer, floating point, or character constant", get(-1));
                    return null;
                }
                inc();
                if ((get() || {}).type !== LexToken.COLON) {
                    Error("':' Expected", get(-1));
                    return null;
                }
                inc();
                if (!parentBlock.registerCase(tok.value)) {
                    Error("Case statement outside a switch() block", tok);
                    return null;
                }
                return true;

            case LexToken.DEFAULT:
                inc();
                if ((get() || {}).type !== LexToken.COLON) {
                    Error("':' Expected", get(-1));
                    return null;
                }
                inc();
                if (!parentBlock.registerCase(null)) {
                    Error("Default statement outside a switch() block", tok);
                    return null;
                }
                return true;

            case LexToken.BREAK:
                inc();
                if ((get() || {}).type !== LexToken.SEMICOLON) {
                    Error("';' Expected", get(-1));
                    return null;
                }
                return new Statement(Statements.BREAK);

            case LexToken.CONTINUE:
                inc();
                if ((get() || {}).type !== LexToken.SEMICOLON) {
                    Error("';' Expected", get(-1));
                    return null;
                }
                return new Statement(Statements.CONTINUE);

            case LexToken.RETURN:
                inc();
                var exp = parseExpression(LexToken.SEMICOLON);
                if (exp === null) return null;
                return new Statement(Statements.RETURN, exp);

            case LexToken.TYPEDEF:
                Error("lolnope", get());
                return null;

            case LexToken.GOTO:
                inc();
                var tok = get() || {};
                if (tok.type !== LexToken.IDENTIFIER) {
                    Error("Expected identifier", get(-1));
                    return null;
                }
                inc();
                if ((get() || {}).type !== LexToken.SEMICOLON) {
                    Error("';' Expected", get(-1));
                    return null;
                }
                inc();
                return new Statement(Statements.GOTO, tok.value);

            default:
                break;
            }
            Error("Unknown or unexpected token", get());
            return null;
        }

        function parseBlock(parentBlock, blockType) {
            var myBlock = new Block(parentBlock, blockType);
            var cexp;
            if ((get() || {}).type === LexToken.LEFTBRACE) {
                inc();
                while (get().type !== LexToken.EOF && get().type !== LexToken.RIGHTBRACE) {
                    cexp = parseStatement(myBlock);
                    if (cexp === null) return null;
                    myBlock.addStatement(cexp);
                }
                inc();
            } else {
                cexp = parseStatement(myBlock);
                if (cexp === null) return null;
                myBlock.addStatement(cexp);
            }
            return myBlock;
        }

        var booboo = parseBlock(null, BlockTypes.FUNCTION);
        if (errors.length === 0) {
            return booboo;
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

// This mostly serves as documentation for how to use the Statement class
// Just call new Statement(Statements.NAME, arg1, arg2, etc)
// the arguments will be put into the fields in the arguments list.

Statements = {
    EXPRESSION: {
        type: 0,
        expression: null,
        arguments: ['expression']
    },
    DECLARATION: {
        type: 1,
        vartype: null,
        expression: null,
        arguments: ['vartype','expression']
    },
    IF: {
        type: 2,
        conditions: [null],
        blocks: [null],
        arguments: ['conditions', 'blocks']
        // Else blocks are handled with a final block with literal `true` conditions
    },
    WHILE: {
        type: 3,
        condition: null,
        block: null,
        dofirst: false,
        arguments: ['dofirst', 'condition', 'block']
    },
    FOR: {
        type: 4,
        initializer: null,
        condition: null,
        iterator: null,
        block: null,
        arguments: ['initializer', 'condition', 'iterator', 'block']
    },
    SWITCH: {
        type: 5,
        expression: null,
        block: null,
        arguments: ['expression', 'block']
    },
    BREAK: {type: 6, arguments: []},
    CONTINUE: {type: 7, arguments: []},
    RETURN: {
        type: 8,
        expression: null,
        arguments: ['expression']
    },
    GOTO: {
        type: 9,
        label: null,
        arguments: ['label']
    },
    WHATEVERBLOCK: {
        type: 10,
        block: null,
        arguments: ['block']
    }
};

function Statement(type) {
    //assert type in Statements
    this.type = type;
    this.Enum = type.type;
    for (var i = 0; i < type.arguments.length; i++) {
        this[type.arguments[i]] = arguments[i+1];
    }
}

var BlockTypes = {
    FUNCTION: 0,
    LOOP: 1,
    SWITCH: 2,
    WHATEVER: 3
};

function Block(parentBlock, blockType) {
    this.blockType = blockType;
    this.vars = {};
    this.statements = [];
    this.labels = {};
    this.cases = {};
    this.parentBlock = parentBlock;
    if (parentBlock) {
        //parentBlock.childBlocks[parentBlock.childBlocks.length] = this;
        this.parentReentryPoint = parentBlock.statements.length + 1;
        // This should be the index of the place to execute next
        // After this block has finished
    }
}

Block.prototype.registerVar = function (variable) {
    this.vars[variable.name] = variable;
};

Block.prototype.resolveVar = function (varname) {
    if (varname in this.vars) return this.vars[varname];
    else if (this.parentBlock) return this.parentBlock.resolveVar(varname);
    else return null;
};

Block.prototype.addLabel = function (label) {
    this.labels[label] = this.statements.length;
};

Block.prototype.addStatement = function (statement) {
    if (statement instanceof Statement) {
        this.statements.push(statement);
    }
};

Block.prototype.registerCase = function (token, childBlock) {
    if (this.blockType === BlockTypes.SWITCH) {
        this.cases[token] = childBlock || this.statements.length;
        return true;
    } else if (this.blockType === BlockTypes.FUNCTION) {
        return false;
    } else {
        if (!this.parentBlock.registerCase(token, this)) {
            return false;
        } else {
            this.cases[token] = childBlock || this.statements.length;
            return true;
        }
    }
};

Block.prototype.registerLabel = function (label, childBlock) {
    this.labels[label] = childBlock || this.statements.length;
    if (this.blockType === BlockTypes.FUNCTION) return;
    this.parentBlock.registerLabel(label, this);
};

/* Funcdata format
{
    args: [Type, Type, ...],
    block: Block
}
*/

