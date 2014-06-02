function PicoC(filesystem, flags) {
    this.flags = flags;
    this.fs = filesystem;
    this.preprocessor = new Preprocessor(this);
    this.lexer = new Lexer(this);
    this.parser = new Parser(this);
    this.sources = {};
}

PicoC.prototype.add = function (filename) {
    var src = this.fs.open(filename);
    if (src.failure) {
        this.Error("Could not open " + filename + ': ' + src.error);
        return;
    }
    var source = src.read();
    src.close();
    var fdata = {source: source};
    var ires = this.preprocessor.preprocess(source);
    if (typeof ires == 'object') {
        for (var i = 0; i < ires.length; i++) {
            this.Error('Error, row ' + ires[i].row + ', char ' + ires[i].col + ': ' + ires[i].msg);
        }
        return false;
    }
    fdata.psource = ires;
    ires = this.lexer.lex(fdata.psource);
    if (typeof ires == 'string') {
        this.Error(ires);
        return false;
    }
    fdata.tokens = ires;
    ires = this.parser.parse(fdata.tokens);
    if (ires instanceof Array) {
        for (var i = 0; i < ires.length; i++) {
            this.Error(ires[i]);
        }
        return false;
    }
    fdata.parseTree = ires;
    this.sources[filename] = fdata;
};

PicoC.prototype.Error = function (msg) {
    this.fs.open('/dev/stderr').write(msg + '\n');
}
