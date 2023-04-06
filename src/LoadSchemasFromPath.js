'use strict'

const fs = require("fs");
const path = require("path");

const loadSchemasFromPath = (schemaDirPath) => {
    const schemasFromPath = []
    const schemaFiles = walkDir(schemaDirPath);
    schemaFiles.forEach((file) => {
        const schema = require(file);
        schemasFromPath.push(schema);
    });
    return schemasFromPath;
};

const walkDir = (schemaDirPath, fileList = []) => {
    const dir = fs.readdirSync(schemaDirPath);
    dir.forEach((file) => {
        const pathFile = path.join(schemaDirPath, file);
        const stat = fs.statSync(pathFile);
        if (stat.isDirectory())
            fileList = walkDir(pathFile, fileList);
        else
            fileList.push(pathFile);
    });
    return fileList
};

module.exports = loadSchemasFromPath;