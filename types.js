
var BaseTypes = {
    VOID: {
        type: 0,
        sizeof: 1,
        proto: 'void'
    },
    INT: {
        type: 1,
        sizeof: 4,
        proto: 'int'
    },
    SHORT: {
        type: 2,
        sizeof: 2,
        proto: 'short'
    },
    CHAR: {
        type: 3,
        sizeof: 1,
        proto: 'char'
    },
    LONG: {
        type: 4,
        sizeof: 8,
        proto: 'long'
    },
    UINT: {
        type: 5,
        sizeof: 4,
        proto: 'unsigned int'
    },
    USHORT: {
        type: 6,
        sizeof: 2,
        proto: 'unsigned short'
    },
    ULONG: {
        type: 7,
        sizeof: 8,
        proto: 'unsigned long'
    },
    FLOAT: {
        type: 8,
        sizeof: 4,
        proto: 'float'
    },
    DOUBLE: {
        type: 16,
        sizeof: 8,
        proto: 'double'
    },
    LDOUBLE: {
        type: 17,
        sizeof: 10,
        proto: 'long double'
    },
    FUNCTION: {
        type: 9,
        sizeof: null,
        proto: null
    },
    POINTER: {
        type: 10,
        sizeof: 4,
        proto: null
    },
    ARRAY: {
        type: 11,
        sizeof: null,
        proto: null
    },
    STRUCT: {
        type: 12,
        sizeof: null,
        proto: null
    },
    UNION: {
        type: 13,
        sizeof: null,
        proto: null
    },
    ENUM: {
        type: 14,
        sizeof: 4,
        proto: null
    },
    TYPE: {
        type: 15,
        sizeof: 0,
        proto: null
    }
};


function parseBasicType(get, inc, block) {
    var tok = get() || {};
    inc();
    if (tok.type in typeMapping) {
        return new BasicType(typeMapping[tok.type]);
    } else if (tok.type in specialTypeMapping) {
        return new specialTypeMapping[tok.type](inc, get, block);
    } else if (tok.type === LexToken.IDENTIFIER) {
        // TODO: lookup from aliased types
    } else {
        // TODO: deal with weird shit like unsigned short int
    }
    return null;
}

function parseBasicStruct(get, inc, block) {
    
}

function parseBasicUnion(get, inc, block) {

}

function parseBasicEnum(get, inc, block) {

}


var typeMapping = {};
typeMapping[LexToken.INTTYPE] = BaseTypes.INT;
typeMapping[LexToken.CHARTYPE] = BaseTypes.CHAR;
typeMapping[LexToken.FLOATTYPE] = BaseTypes.FLOAT;
typeMapping[LexToken.DOUBLETYPE] = BaseTypes.DOUBLE;
typeMapping[LexToken.VOIDTYPE] = BaseTypes.VOID;

var specialTypeMapping = {};
specialTypeMapping[LexToken.STRUCTTYPE] = BaseTypes.STRUCT;
specialTypeMapping[LexToken.UNIONTYPE] = BaseTypes.UNION;
specialTypeMapping[LexToken.ENUMTYPE] = BaseTypes.ENUM;


function sortLvalType(baseType, expr, parentBlock) {
    if (expr.token && expr.token.type === LexToken.IDENTIFIER) {
        parentBlock.registerVar(new Variable(expr.token, baseType, null));
        return expr;
    } else if (expr.opnum === Operators.ASSIGNMENT.Enum) {
        var res = digOutType(baseType, expr.operand1);
        if (res === null || typeof res == 'string') return res;
        expr.operand1 = res.rootToken;
        parentBlock.registerVar(new Variable(res.rootToken, res.type));
        return expr;
    } else if (expr.opnum === Operators.SUBSCRIPT.Enum
            || expr.opnum === Operators.DEREF.Enum
            || expr.opnum === Operators.FUNCTIONCALL.Enum) {
        var res = digOutType(baseType, expr);
        if (res === null || typeof res == 'string') return res;
        parentBlock.registerVar(new Variable(res.rootToken, res.type, null));
        return new ValueNode(res.rootToken);
    } else {
        return "Bad type of expression in declaration";
    }
}

function digOutType(baseType, expr) {
    if (expr.token && expr.token.type === LexToken.IDENTIFIER) {
        return {
            rootToken: expr.token,
            type: new BasicType(baseType)
        };
    } else if (expr.opnum === Operators.DEREF.Enum) {
        var interim = digOutType(baseType, expr.operand1);
        if (interim === null || typeof interim == 'string') return interim;
        return {
            rootToken: interim.rootToken,
            type: new PointerType(interim.type)
        };
    } else if (expr.opnum === Operators.SUBSCRIPT.Enum) {
        if (expr.operand2.token && expr.operand2.token.type === LexToken.INTEGERCONSTANT) {
            var interim = digOutType(baseType, expr.operand1);  // TODO: implicitly sized arrays
            if (interim === null || typeof interim == 'string') return interim;
            return {
                rootToken: interim.rootToken,
                type: new ArrayType(nterim.type, expr.operand2.token.value)
            };
        }
    } else if (expr.opnum === Operators.FUNCTIONCALL.Enum) {
        return 'Function pointers REALLY aren\'t supported yet!';
    } else {
        return "Bad type of expression in declaration";
    }
}

function Variable(nametoken, type, value) {
    this.name = nametoken.value;
    this.nametoken = nametoken;
    this.type = type;
    this.metaSource = nametoken.metaSource;
}

/* All type classes implement the following interface:
{
    BaseTypes baseType;
    int sizeof;
    String proto;
}
*/

function BasicType(type) {
    this.baseType = type;
    this.sizeof = type.sizeof;
    this.proto = type.proto;
}

function StructType(name, idents, types) {
    this.baseType = BaseTypes.STRUCT;
    this.name = name;
    if (!name)
        this.proto = 'struct {';
    else
        this.proto = 'struct ' + name;
    this.sizeof = 0;
    this.members = {};
    for (var i = 0; i < idents.length; i++) {
        if (!name)
            this.proto += types[i].proto + ' ' + idents[i] + ';';
        this.members[idents[i]] = {
            offset: this.sizeof,
            type: types[i]
        };
        this.sizeof += types[i].sizeof;
    }
    if (!name)
        this.proto += '}';
}

function ArrayType(type, length) {
    this.baseType = BaseTypes.ARRAY;
    this.type = type;
    this.length = length;
    this.sizeof = type.sizeof*length;
    this.proto = '(' + type.proto + ')[' + length.toString() + ']';
}

function UnionType(name, idents, types) {
    this.baseType = BaseTypes.UNION;
    this.name = name;
    if (!name)
        this.proto = 'union {';
    else
        this.proto = 'union ' + name;
    this.sizeof = 0;
    this.members = {};
    for (var i = 0; i < idents.length; i++) {
        if (!name)
            this.proto += types[i].proto + ' ' + idents[i] + ';';
        this.members[idents[i]] = types[i];
        this.sizeof = Max(this.sizeof, types[i].sizeof);
    }
    if (!name)
        this.proto += '}';
}

function FunctionType(returnType, argTypes) {
    this.baseType = BaseTypes.FUNCTION;
    this.sizeof = 0;
    this.returnType = returnType;
    this.argTypes = argTypes;
    this.proto = '(' + returnType.proto + ')(' + argTypes.map(function (x) {return x.proto;}).join(',') + ')';
}

function PointerType(type) {
    this.baseType = BaseTypes.POINTER;
    this.sizeof = 4;
    this.type = type;
    if (type instanceof PointerType || type instanceof ArrayType)
        this.proto = type.proto + '*';
    else
        this.proto = '(' + type.proto + ')*';
}
