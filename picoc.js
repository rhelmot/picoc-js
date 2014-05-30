function PicoC(filesystem, flags) {
    this.flags = flags;
    this.fs = filesystem;
    this.preprocessor = new Preprocessor(this);
    this.lexer = new Lexer(this);
    this.parser = new Parser(this);
    this.sources = {};
}

PicoC.prototype.add = function (filename, sysinclude) {
    var ufs = sysinclude ? sysfs : this.fs;
    var src = ufs.open(filename);
    if (src.failure) {
        this.Error("Could not open " + filename + ': ' + src.error);
        return;
    }
    var source = src.read();
    src.close();
    if (sysinclude) filename = '<' + filename + '>';
    var fdata = {source: source};
    var ires = this.preprocessor.preprocess(source);
    if (typeof ires == 'object') {
        for (var i = 0; i < ires.length; i++) {
            this.Error('Error, row ' + ires[i].row + ', char ' + ires[i].col + ': ' + ires[i].msg);
        }
        return;
    }
    fdata.psource = ires;
    ires = this.lexer.lex(fdata.psource);
}
