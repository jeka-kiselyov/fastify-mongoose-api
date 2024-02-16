import type { TFMASchema } from '../types.js';
import { statSync, readdirSync } from 'fs';
import path from 'path';

const loadSchemasFromPath = async (
    schemaDirPath: string
): Promise<TFMASchema[]> => {
    const schemasFromPath: TFMASchema[] = [];
    const schemaFiles = walkDir(schemaDirPath);
    for await (const file of schemaFiles) {
        try {
            const schema = (await import(file)).default as TFMASchema;
            if (typeof schema === 'function') schemasFromPath.push(schema);
        } catch (e: any) {
            throw new Error(`Error loading schema ${file}: ${e.message}`);
        }
    }
    return schemasFromPath;
};

const walkDir = (schemaDirPath: string, fileList: string[] = []): string[] => {
    const dir = readdirSync(schemaDirPath);
    dir.forEach(file => {
        const pathFile = path.join(schemaDirPath, file);
        const stat = statSync(pathFile);
        if (stat.isDirectory()) fileList = walkDir(pathFile, fileList);
        else fileList.push(pathFile);
    });
    return fileList;
};

export { loadSchemasFromPath };
