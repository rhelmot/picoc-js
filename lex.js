String.prototype.i = function() { return this.charCodeAt(0); };

//Tokens enum
var LexToken = {
    NONE: 0, COMMA: 1, ASSIGN: 2, ADDASSIGN: 3, SUBTRACTASSIGN: 4, MULTIPLYASSIGN: 5, DIVIDEASSIGN: 6,
    MODULUSASSIGN: 7, SHIFTLEFTASSIGN: 8, SHIFTRIGHTASSIGN: 9, 
    ARITHMETICANDASSIGN: 10, ARITHMETICORASSIGN: 11, ARITHMETICXORASSIGN: 12,
    QUESTIONMARK: 13, COLON: 14, LOGICALOR: 15, LOGICALAND: 16, ARITHMETICOR: 17, ARITHMETICXOR: 18,
    AMPERSAND: 19, EQUAL: 20, NOTEQUAL: 21, LESSTHAN: 22, GREATERTHAN: 23, LESSEQUAL: 24, GREATEREQUAL: 25,
    SHIFTLEFT: 26, SHIFTRIGHT: 27, PLUS: 28, MINUS: 29, ASTERISK: 30, SLASH: 31, MODULUS: 32,
    INCREMENT: 33, DECREMENT: 34, UNARYNOT: 35, UNARYXOR: 36,
    SIZEOF: 37, CAST: 38, LEFTSQUAREBRACKET: 39, RIGHTSQUAREBRACKET: 40, DOT: 41, ARROW: 42,
    OPENBRACKET: 43, CLOSEBRACKET: 44, IDENTIFIER: 45,
    INTEGERCONSTANT: 46, FPCONSTANT: 47, STRINGCONSTANT: 48, CHARACTERCONSTANT: 49,
    SEMICOLON: 50, ELLIPSIS: 51, LEFTBRACE: 52, RIGHTBRACE: 53,
    INTTYPE: 54, CHARTYPE: 55, FLOATTYPE: 56, DOUBLETYPE: 57, VOIDTYPE: 58, ENUMTYPE: 59, LONGTYPE: 60,
    SIGNEDTYPE: 61, SHORTTYPE: 62, STATICTYPE: 63, AUTOTYPE: 64, REGISTERTYPE: 65, EXTERNTYPE: 66,
    STRUCTTYPE: 67, UNIONTYPE: 68, UNSIGNEDTYPE: 69, TYPEDEF: 70,
    CONTINUE: 71, DO: 72, ELSE: 73, FOR: 74, GOTO: 75, IF: 76, WHILE: 77, BREAK: 78, SWITCH: 79,
    CASE: 80, DEFAULT: 81, RETURN: 82,
    HASHDEFINE: 83, HASHINCLUDE: 84, HASHIF: 85, HASHIFDEF: 86, HASHIFNDEF: 87, HASHELSE: 88, HASHENDIF: 89,
    NEW: 90, DELETE: 91, OPENMACROBRACKET: 92, EOF: 93, ENDOFLINE: 94, ENDOFFUNCTION: 95
};

var ReservedWords = {
    "#define": LexToken.HASHDEFINE,
    "#else": LexToken.HASHELSE,
    "#endif": LexToken.HASHENDIF,
    "#if": LexToken.HASHIF,
    "#ifdef": LexToken.HASHIFDEF,
    "#ifndef": LexToken.HASHIFNDEF,
    "#include": LexToken.HASHINCLUDE,
    "auto": LexToken.AUTOTYPE,
    "break": LexToken.BREAK,
    "case": LexToken.CASE,
    "char": LexToken.CHARTYPE,
    "continue": LexToken.CONTINUE,
    "default": LexToken.DEFAULT,
    "delete": LexToken.DELETE,
    "do": LexToken.DO,
    "double": LexToken.DOUBLETYPE,
    "else": LexToken.ELSE,
    "enum": LexToken.ENUMTYPE,
    "extern": LexToken.EXTERNTYPE,
    "float": LexToken.FLOATTYPE,
    "for": LexToken.FOR,
    "goto": LexToken.GOTO,
    "if": LexToken.IF,
    "int": LexToken.INTTYPE,
    "long": LexToken.LONGTYPE,
    "new": LexToken.NEW,
    "register": LexToken.REGISTERTYPE,
    "return": LexToken.RETURN,
    "short": LexToken.SHORTTYPE,
    "signed": LexToken.SIGNEDTYPE,
    "sizeof": LexToken.SIZEOF,
    "static": LexToken.STATICTYPE,
    "struct": LexToken.STRUCTTYPE,
    "switch": LexToken.SWITCH,
    "typedef": LexToken.TYPEDEF,
    "union": LexToken.UNIONTYPE,
    "unsigned": LexToken.UNSIGNEDTYPE,
    "void": LexToken.VOIDTYPE,
    "while": LexToken.WHILE
};

function Lexer(picoparent) {
    this.picoparent = picoparent;
    var LexMode = {
        NORMAL: 0, HASHINCLUDE: 1, HASHDEFINE: 2, HASHDEFINESPACE: 3, HASHDEFINESPACEIDENT: 4
    };

    var uc = {zero:0x30, nine:0x39, A:0x41, F:0x46, Z:0x5A, a:0x61, f:0x66, z:0x7A};
    function isalpha(c) {var i = c.i(); return (i >= uc.a && i <= uc.z) || (i >= uc.A && i <= uc.Z);}
    function isdigit(c) {var i = c.i(); return i >= uc.zero && i <= uc.nine;}
    function isalnum(c) {return isalpha(c) || isdigit(c);}
    function isspace(c) {return c == ' ' || c == '\t' || c == '\r' || c == '\n';}
    function isCidstart(c) {return isalpha(c) || c == '_' || c == '#';}
    function isCident(c) {return isalnum(c) || c == '_';}
    function IS_HEX_ALPHA_DIGIT(c) {var i = c.i(); return (i >= uc.a && i <= uc.f) || (i >= uc.A && i <= uc.F);}
    function IS_BASE_DIGIT(c,b) {var i = c.i(); return (i >= uc.zero && i < uc.zero + (b<10?b:10)) || (b > 10 && IS_HEX_ALPHA_DIGIT(c));}
    function GET_BASE_DIGIT(c) {var i = c.i(); return ((i <= uc.nine) ? (i-uc.zero) : ((i <= uc.F) ? (i - uc.A + 10) : (i - uc.a + 10)));}
    

    /* NextIs is a combination of NEXTIS macros from the original lex.c
     * that perform basic switch statements based on the next character
     * in the input stream to parse operator types.
     *
     * Ex: If we found an '=', we want to know if it's an assigment operator
     * or an equality test operator, so we call:
     * NextIs({'=': LexToken.EQUAL}, LexToken.ASSIGN)
     * or something like that.
     *
     * The other NextIs functions are for operators of more than 2 chars.
     */


    this.lex = function (source) {
        var masterPos = new SourcePosition(source);
        var tokenList = [];
        var mode = LexMode.NORMAL;
        var error = '';

        function inc(n) {
            masterPos.next(n);
        }

        function getc(n) {
            return masterPos.getChar(n);
        }

        function Error(msg) {
            if (error != '') return;
            error = 'Error: ' + masterPos.toString() + ': ' + msg;
        }
    
        function NextIs(chrs, def) {
            var src = getc();
            var pos = masterPos.copy();
            inc();
            for (c in chrs) {
                if (c === null) continue;
                if (getc() === c) {
                    src += c;
                    inc();
                    return new Token(chrs[c], pos, src);
                }
            }
            return new Token(def, pos, src);
        }

        function NextIs3Plus(c,x,d,y,e,z,a) {
            var src = getc();
            var pos = masterPos.copy();
            inc();
            if (getc() === c) {
                src += c;
                inc(); 
                return new Token(x, pos, src);
            } else if (getc() === d) {
                src += d;
                if (getc(1) == e) {
                    src += e;
                    inc(2);
                    return new Token(z, pos, src);
                } else { 
                    inc();
                    return new Token(y, pos, src);
                } 
            } else {
                return new Token(a, pos, src);
            }
        }
        function NextIsExactly3(c,d,y,z) {
            var src = getc();
            var pos = masterPos.copy();
            inc();
            if (getc() === c && getc(1) === d) { 
                src += c + d;
                inc(2);
                return new Token(y, pos, src);
            } else {
                return new Token(z, pos, src);
            }
        }

        function Basic(c) {
            var src = getc();
            var pos = masterPos.copy();
            inc();
            return new Token(c, pos, src);
        }

        function Tokenize() {
            while (error == '') {
                var t = ScanGetToken();
                tokenList.push(t);
                if (t.type === LexToken.EOF) break;
            }
        }

        function ScanGetToken() {
            var ThisChar, NextChar, GotToken = LexToken.NONE;

            // I don't think we need the EmitExtraNewlines stuff?

            while (masterPos.chr < masterPos.length() && isspace(getc())) {
                if (getc() == '\n') {
                    GotToken = new Token(LexToken.ENDOFLINE, masterPos.copy(), '\n');
                    masterPos.newline();
                    if (mode !== LexMode.NORMAL) {
                        mode = LexMode.NORMAL;
                        return GotToken;
                    }
                } else {
                    inc();
                    if (mode == LexMode.HASHDEFINE || mode == LexMode.HASHDEFINESPACE) {
                        mode = LexMode.HASHDEFINESPACE;
                    } else if (mode == LexMode.HASHDEFINESPACEIDENT) {
                        mode = LexMode.NORMAL;
                    }
                }
            }
            if (masterPos.chr >= masterPos.length() || getc() == '\0') {
                return new Token(LexToken.EOF, masterPos.copy(), '');
            }
            ThisChar = getc();
            if (isCidstart(ThisChar)) {
                return GetWord();
            } else if (isdigit(ThisChar)) {
                return GetNumber();
            }

            NextChar = (masterPos.chr + 1 < masterPos.length()) ? getc(1) : '\0';
            switch (ThisChar) {
                case '"':
                    return GetStringConstant('"');
                case '\'':
                    return GetCharacterConstant();
                case '(':
                    if (mode === LexMode.HASHDEFINESPACEIDENT) {
                        GotToken = new Token(LexToken.OPENMACROBRACKET, masterPos.copy(), '(');
                    } else {
                        GotToken = new Token(LexToken.OPENBRACKET, masterPos.copy(), '(');
                    }
                    inc();
                    mode = LexMode.NORMAL;
                    return GotToken;
                case ')': return Basic(LexToken.CLOSEBRACKET);
                case '=':
                          return NextIs({'=': LexToken.EQUAL}, LexToken.ASSIGN);
                case '+':
                          return NextIs({'=': LexToken.ADDASSIGN, '+': LexToken.INCREMENT}, LexToken.PLUS);
                case '-':
                          return NextIs({
                              '=': LexToken.SUBTRACTASSIGN,
                                 '>': LexToken.ARROW,
                                 '-': LexToken.DECREMENT}, LexToken.MINUS);
                case '*':
                          return NextIs({'=': LexToken.MULTIPLYASSIGN}, LexToken.ASTERISK);
                case '/':
                          if (NextChar === '/' || NextChar === '*') {
                              SkipComment();
                              return ScanGetToken();
                          } else {
                              return NextIs({'=': LexToken.DIVIDEASSIGN}, LexToken.SLASH);
                          }
                case '%':
                          return NextIs({'=': LexToken.MODULUSASSIGN}, LexToken.MODULUS);
                case '<':
                          if (mode === LexMode.HASHINCLUDE) {
                              return GetStringConstant('>');
                          } else {
                              return NextIs3Plus('=', LexToken.LESSEQUAL,
                                      '<', LexToken.SHIFTLEFT,
                                      '=', LexToken.SHIFTLEFTASSIGN,
                                      LexToken.LESSTHAN);
                          }
                case '>':
                          return NextIs3Plus('=', LexToken.GREATEREQUAL,
                                  '<', LexToken.SHIFTRIGHT,
                                  '=', LexToken.SHIFTRIGHTASSIGN,
                                  LexToken.GREATERTHAN);
                case ';': return Basic(LexToken.SEMICOLON);
                case '&':
                          return NextIs({'=': LexToken.ARITHMETICANDASSIGN, '&': LexToken.LOGICALAND}, LexToken.AMPERSAND);
                case '|':
                          return NextIs({'=': LexToken.ARITHMETICORASSIGN, '|': LexToken.LOGICALOR}, LexToken.ARITHMETICOR);
                case '{': return Basic(LexToken.LEFTBRACE);
                case '}': return Basic(LexToken.RIGHTBRACE);
                case '[': return Basic(LexToken.LEFTSQUAREBRACKET);
                case ']': return Basic(LexToken.RIGHTSQUAREBRACKET);
                case '!':
                          return NextIs({'=': LexToken.NOTEQUAL}, LexToken.UNARYNOT);
                case '^':
                          return NextIs({'=': LexToken.ARITHMETICXORASSIGN}, LexToken.ARITHMETICXOR);
                case '~': return Basic(LexToken.UNARYXOR);
                case ',': return Basic(LexToken.COMMA);
                case '.':
                          return NextIsExactly3('.','.', LexToken.ELLIPSIS, LexToken.DOT);
                case '?': return Basic(LexToken.QUESTIONMARK);
                case ':': return Basic(LexToken.COLON);
                default:
                          Error("Illegal character '" + ThisChar + '"');
                          return new Token(LexToken.EOF);
            }
        }

        function GetWord() {
            var word = '';
            var position = masterPos.copy();
            do {
                word += getc();
                inc();
            } while (masterPos.chr != masterPos.length() && isCident(getc()));
            var token = new Token(LexToken.IDENTIFIER, position, word);
            if (word in ReservedWords) {
                token.type = ReservedWords[word];
                if (token.type == LexToken.HASHINCLUDE) mode = LexMode.HASHINCLUDE;
                else if (token.type == LexToken.HASHDEFINE) mode = LexMode.HASHDEFINE;
            } else {
                token.value = word;
                if (mode == LexMode.HASHDEFINESPACE) mode = LexMode.HASHDEFINESPACEIDENT;
            }
            return token;
        }

        function GetNumber() {
            var result = 0, base = 10;
            var token = new Token(null, masterPos.copy(), '', 0);
            if (getc() === '0') {   // Alternate base
                token.source += '0';
                inc();
                if (!masterPos.isEOF()) {
                    var c = getc();
                    if (c === 'x' || c === 'X') {
                        base = 16;
                        token.source += c;
                        inc();
                    } else if (c === 'b' || c === 'B') {
                        base = 2;
                        token.source += c;
                        inc();
                    } else {
                        base = 8;
                    }
                }
            }
            while (!masterPos.isEOF() && IS_BASE_DIGIT(getc(), base)) {
                var c = getc();
                token.source += c;
                result *= base;
                result += GET_BASE_DIGIT(c);
                inc();
            }
            token.value = result;
            if (result >= 0 && result <= 255) {
                token.type = LexToken.CHARACTERCONSTANT;
            } else {
                token.type = LexToken.INTEGERCONSTANT;
            }
            if (masterPos.isEOF()) {
                return token;
            }
            var c = getc();
            if (c === 'l' || c === 'L') {
                token.source += c;
                inc();
                return token;
            }
            if (masterPos.isEOF() || getc() !== '.') {
                return token;
            }
            token.source += '.';
            token.type = LexToken.FPCONSTANT;
            inc();
            var fpdiv = 1.0/base;
            var fpresult = result;
            c = getc();
            while (!masterPos.isEOF() && IS_BASE_DIGIT(c, base)) {
                token.source += c;
                fpresult += GET_BASE_DIGIT(c) * fpdiv;
                fpdiv /= base;
                inc();
                c = getc();
            }
            if (!masterPos.isEOF() && (getc() === 'e' || getc() === 'E')) {
                var exponentSign = 1;
                token.source += getc();
                inc();
                if (!masterPos.isEOF() && getc() === '-') {
                    token.source += '-';
                    exponentSign = -1;
                    inc();
                }
                result = 0;
                while (!masterPos.isEOF() && IS_BASE_DIGIT(getc(), base)) {
                    c = getc();
                    token.source += c;
                    result *= base;
                    result += GET_BASE_DIGIT(c);
                    inc();
                }
                fpresult *= Math.pow(base, result * exponentSign);
            }
            token.value = fpresult;
            return token;
        }

        function SkipComment() {
            inc();
            if (getc() === '*') {
                inc();
                while (getc() !== '*' && getc(1) !== '/') {
                    if (getc() === '\n') masterPos.newline();
                    else inc();
                }
                inc(2);
            } else {
                while (getc() !== '\n') inc();
                masterPos.newline();
            }
        }

        function GetStringConstant(eos) {
            var pos = masterPos.copy();
            var val = '';
            inc();
            while (getc() != eos) {
                val += ExtractCharacter();
            }
            inc();
            var src = masterPos.source.slice(pos.chr, masterPos.chr);
            return new Token(LexToken.STRINGCONSTANT, pos, src, val);
        }

        function GetCharacterConstant() {
            var pos = masterPos.copy();
            var src = "'";
            inc();
            var val = ExtractCharacter();
            src += val;
            if (getc() !== "'") {
                Error('Expected "\'"');
                return new Token(LexToken.EOF);
            }
            inc();
            src += "'";
            return new Token(LexToken.CHARACTERCONSTANT, pos, src, val);
        }

        function ExtractCharacter() {
            var c = getc();
            inc();
            if (c === '\\') {
                if (masterPos.isEOF()) return '\\';
                if (getc() === '\r') {
                    if (getc() === '\n') {
                        inc();
                        masterPos.newline();
                    } else {
                        masterPos.newline();
                    }
                    return ExtractCharacter();
                } else if (getc() === '\n') {
                    masterPos.newline();
                    return ExtractCharacter();
                }
                c = getc();
                inc();
                switch (c) {
                    case '\\': return '\\';
                    case "'": return "'";
                    case '"': return '"';
                    case 'a': return '\a';
                    case 'b': return '\b';
                    case 'f': return '\f';
                    case 'n': return '\n';
                    case 'r': return '\r';
                    case 'v': return '\v';
                    case '0': return '\0';
                    case '1': return '\1';
                    case '2': return '\2';
                    case '3': return '\3';
                    default:  return c;
                }
            }
            if (c === '\n') {
                Error("Expected termination char, not newline");
            }
            return c;
        }

        Tokenize();
        if (error !== '') {
            return error;
        } else {
            return tokenList;
        }
    };

}



function SourcePosition(source, chr, line, col) {
    this.chr = chr || 0;
    this.line = line || 1;
    this.col = col || 1;
    this.source = source;
}

SourcePosition.prototype.copy = function() {
    return new SourcePosition('', this.chr, this.line, this.col);
};

SourcePosition.prototype.next = function(n) {
    this.chr += n || 1;
    this.col += n || 1;
};

SourcePosition.prototype.newline = function() {
    this.chr++;
    this.col = 1;
    this.line++;
};

SourcePosition.prototype.toString = function () {
    return "Line " + this.line + ", Character " + this.col;
};

SourcePosition.prototype.getChar = function (n) {
    return this.source[this.chr + (n || 0)];
};

SourcePosition.prototype.length = function () {
    return this.source.length;
};

SourcePosition.prototype.isEOF = function () {
    return this.chr >= this.length();
};


function Token(type, metaSource, source, value) {
    this.type = type;
    this.value = value;
    this.metaSource = metaSource;       // SourcePosition object, null source attr
    this.source = source;               // text code which made up this code
}
