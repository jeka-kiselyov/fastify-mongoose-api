'use strict';

const fs = require('fs');
const path = require('path');
const importSync = require('import-sync');

const loadSchemasFromPath = (schemaDirPath, filterFn) => {
    const schemasFromPath = [];
    const schemaFiles = walkDir(schemaDirPath, filterFn);
    schemaFiles.forEach(file => {
        const schema = importSync(file);
        schemasFromPath.push(schema.default || schema);
    });
    return schemasFromPath;
};

const walkDir = (schemaDirPath, filterFn, fileList = []) => {
    const dir = fs.readdirSync(schemaDirPath);
    dir.forEach(file => {
        const pathFile = path.join(schemaDirPath, file);
        const stat = fs.statSync(pathFile);
        if (stat.isDirectory()) {
            fileList = walkDir(pathFile, filterFn, fileList);
        } else if (filterFn(schemaDirPath, file)) {
            fileList.push(pathFile);
        }
    });
    return fileList;
};

module.exports = loadSchemasFromPath;
