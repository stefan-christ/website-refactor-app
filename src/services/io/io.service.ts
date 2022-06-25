import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { jsonc } from 'jsonc';
import * as path from 'path';

@Injectable()
export class IoService {
    get sep(): string {
        return path.sep;
    }

    join(...pathSegments: string[]): string {
        return path.join(...pathSegments);
    }

    pathExists(fileOrDirPath: string): boolean {
        const normalized = path.normalize(fileOrDirPath);
        return fs.existsSync(normalized);
    }

    async ensureDirectory(dirPath: string): Promise<void> {
        const normalized = path.normalize(dirPath);
        if (!fs.existsSync(normalized)) {
            return new Promise<void>((resolve, reject) => {
                fs.mkdir(normalized, { recursive: true }, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }

    async rimraf(dirPath: string): Promise<void> {
        const normalized = path.normalize(dirPath);
        if (!fs.existsSync(normalized)) {
            return;
        }
        return new Promise<void>((resolve, reject) => {
            fs.rm(normalized, { recursive: true, force: true }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async writeTextFile(filePath: string, data: string): Promise<void> {
        const normalized = path.normalize(filePath);
        return new Promise<void>((resolve, reject) => {
            fs.writeFile(normalized, data, 'utf-8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async writeJsonFile(filePath: string, data: unknown): Promise<void> {
        // filePath will be normalized in writeTextFile
        return this.writeTextFile(filePath, JSON.stringify(data, undefined, 2));
    }

    async readTextFile(filePath: string): Promise<string> {
        const normalized = path.normalize(filePath);

        return new Promise<string>((resolve, reject) => {
            fs.readFile(
                normalized,
                {
                    encoding: 'utf-8',
                    flag: 'r',
                },
                (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                },
            );
        });
    }

    async readJsonFile<T>(filePath: string): Promise<T> {
        // filePath will be normalized in readTextFile
        const text = await this.readTextFile(filePath);
        return jsonc.parse(text);
    }

    async listFiles(
        dirPath: string,
        options: {
            recursive: boolean;
            relative: boolean;
            includedExtensions?: string[];
            excludedExtensions?: string[];
        },
    ): Promise<string[]> {
        const normalized = path.normalize(dirPath);

        let resultFiles: string[] = [];
        const recursion = async (pathToDir: string): Promise<void> => {
            await new Promise<void>((resolve, reject) => {
                fs.readdir(
                    pathToDir,
                    {
                        encoding: 'utf-8',
                        withFileTypes: true,
                    },
                    async (err, dirents) => {
                        if (err) {
                            reject(err);
                        } else {
                            const files = dirents
                                .filter((dirent) => {
                                    if (!dirent.isFile()) {
                                        return false;
                                    }
                                    const direntExtension =
                                        this.getFileExtension(dirent.name);

                                    let included = true;
                                    if (
                                        included &&
                                        options.includedExtensions !== undefined
                                    ) {
                                        included =
                                            options.includedExtensions.includes(
                                                direntExtension,
                                            );
                                    }

                                    if (
                                        included &&
                                        options.excludedExtensions !== undefined
                                    ) {
                                        included =
                                            !options.excludedExtensions.includes(
                                                direntExtension,
                                            );
                                    }
                                    return included;
                                })
                                .map((dirent) =>
                                    path.join(pathToDir, dirent.name),
                                );
                            resultFiles.push(...files);

                            if (options.recursive) {
                                const dirs = dirents.filter((dirent) =>
                                    dirent.isDirectory(),
                                );
                                for (const dir of dirs) {
                                    await recursion(
                                        path.join(pathToDir, dir.name),
                                    );
                                }
                            }
                            resolve();
                        }
                    },
                );
            });
        };

        await recursion(normalized);

        if (options.relative) {
            const normalizedDirPathLength = normalized.length;
            resultFiles = resultFiles.map((file) =>
                file.substring(normalizedDirPathLength + 1),
            );
        }

        return resultFiles.sort();
    }

    getFileExtension(fileName: string): string {
        let extension = path.extname(fileName);
        if (extension === '') {
            if (fileName.startsWith('.')) {
                extension = fileName;
            }
        }
        return extension;
    }

    async getFileExtensionList(
        dirPath: string,
        recursive: boolean,
    ): Promise<string[]> {
        const normalized = path.normalize(dirPath);

        const types: string[] = [];

        const recursion = async (pathToDir: string): Promise<void> => {
            // console.log('IoService.getFileTypes. Scanning', pathToDir);
            await new Promise<void>((resolve, reject) => {
                fs.readdir(
                    pathToDir,
                    {
                        encoding: 'utf-8',
                        withFileTypes: true,
                    },
                    async (err, dirents) => {
                        if (err) {
                            reject(err);
                        } else {
                            const files = dirents.filter((dirent) =>
                                dirent.isFile(),
                            );

                            for (const file of files) {
                                let extension = this.getFileExtension(
                                    file.name,
                                );

                                if (!types.includes(extension)) {
                                    types.push(extension);
                                }
                            }

                            if (recursive) {
                                const dirs = dirents.filter((dirent) =>
                                    dirent.isDirectory(),
                                );
                                for (const dir of dirs) {
                                    await recursion(
                                        path.join(pathToDir, dir.name),
                                    );
                                }
                            }
                            resolve();
                        }
                    },
                );
            });
        };

        await recursion(normalized);

        return types.sort();
    }
}
