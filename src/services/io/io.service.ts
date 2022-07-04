import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { jsonc } from 'jsonc';
import * as path from 'path';
import { Directory, File, Link, Tree } from '../file-provider/file-model';

@Injectable()
export class IoService {
    get sep(): string {
        return path.sep;
    }

    getTimestamp(): string {
        let ts = new Date()
            .toISOString()
            .replace('T', ' ')
            .replace(':', '.')
            .replace(':', '.')
            .substring(0, 19);
        return ts;
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

    getNameFromPath(fileOrDirPath: string): string {
        const normalized = path.normalize(fileOrDirPath);
        return path.basename(normalized);
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

    async getTree(dirPath: string): Promise<Tree> {
        const recursion = async (
            parentDirectory: Directory,
            dirPath: string,
        ): Promise<void> => {
            await new Promise<void>((resolve, reject) => {
                fs.readdir(
                    dirPath,
                    {
                        encoding: 'utf-8',
                        withFileTypes: true,
                    },
                    async (err, dirents) => {
                        if (err) {
                            reject(err);
                        } else {
                            const parentPath = this.join(
                                parentDirectory.parentPath,
                                parentDirectory.name,
                                this.sep,
                            );

                            const files = dirents.filter(
                                (dirent) =>
                                    dirent.isFile() && !dirent.isSymbolicLink(),
                            );
                            const dirs = dirents.filter(
                                (dirent) =>
                                    dirent.isDirectory() &&
                                    !dirent.isSymbolicLink(),
                            );
                            const links = dirents.filter((dirent) =>
                                dirent.isSymbolicLink(),
                            );

                            if (links && links.length > 0) {
                                parentDirectory.links = links.map<Link>(
                                    (dirent) => {
                                        return {
                                            name: dirent.name,
                                            parentPath,
                                        };
                                    },
                                );
                            }

                            if (files && files.length > 0) {
                                parentDirectory.files = files.map<File>(
                                    (dirent) => {
                                        return {
                                            name: dirent.name,
                                            parentPath,
                                            extension: this.getFileExtension(
                                                dirent.name,
                                            ),
                                        };
                                    },
                                );
                            }

                            if (dirs && dirs.length > 0) {
                                parentDirectory.directories =
                                    dirs.map<Directory>((dirent) => {
                                        return {
                                            name: dirent.name,
                                            parentPath,
                                        };
                                    });

                                for (const containerDir of parentDirectory.directories) {
                                    await recursion(
                                        containerDir,
                                        this.join(
                                            containerDir.parentPath,
                                            containerDir.name,
                                        ),
                                    );
                                }
                            }

                            resolve();
                        }
                    },
                );
            });
        };

        const normalized = path.normalize(dirPath) + this.sep;
        const tree: Tree = {
            name: this.getNameFromPath(normalized),
            parentPath: this.join(path.dirname(normalized), this.sep),
            type: 'local',
        };
        // console.log('tree', tree);
        await recursion(tree, normalized);
        return tree;
    }
}
