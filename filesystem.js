function Filesystem() {
    this.files = {}
}

Filesystem.prototype.open = function (path) {
    return new FileHandle(this, path);
};

Filesystem.prototype.touch = function (path) {
    if (path in this.files) return;
    this.files[path] = {
        name: path,
        data: '',
        size: data.length,
        handle: null
    };
};



function FileHandle (fs, path) {
    this.fs = fs;
    this.path = path;
    if (!(path in fs.files)) {
        this.failure = true;
        this.error = "File not found";
        return;
    }
    this.file = fs.files[path];
    if (this.file.handle) {
        this.failure = true;
        this.error = "File busy";
        return;
    }
}

FileHandle.prototype.read = function () {
    if (this.failure) return;
    return this.file.data;
};

FileHandle.prototype.write = function (data) {
    if (this.failure) return;
    this.file.data = data;
    this.file.size = data.length;
};

FileHandle.prototype.close = function () {
    if (this.failure) return;
    this.failure = true;
    this.error = "File closed";
    this.file.handle = null;
};
