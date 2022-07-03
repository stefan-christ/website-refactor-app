import { Injectable } from '@nestjs/common';
import { FtpService } from '../ftp/ftp.service';
import { IoService } from '../io/io.service';
import { Directory, File } from './file-model';

@Injectable()
export class FileProviderService {
    private remoteTree?: Directory;
    private localTreeMap?: Map<string, Directory> = new Map();

    constructor(
        private readonly ftp: FtpService,
        private readonly io: IoService,
    ) {}

    getFileExtensionList(directory: Directory, recursive: boolean): string[] {
        const types: string[] = [];

        const recursion = async (parentDirectory: Directory): Promise<void> => {
            if (parentDirectory.files) {
                for (const file of parentDirectory.files) {
                    if (!types.includes(file.extension)) {
                        types.push(file.extension);
                    }
                }
            }

            if (recursive && parentDirectory.directories) {
                for (const dir of parentDirectory.directories) {
                    recursion(dir);
                }
            }
        };

        recursion(directory);

        return types.sort();
    }

    async listFiles(
        directory: Directory,
        options: {
            recursive: boolean;
            includedExtensions?: string[];
            excludedExtensions?: string[];
        },
    ): Promise<File[]> {
        let files: File[] = [];

        const recursion = (parentDirectory: Directory): void => {
            if (parentDirectory.files) {
                const dirFiles = parentDirectory.files.filter((file) => {
                    const direntExtension = file.extension;

                    let included = true;
                    if (included && options.includedExtensions !== undefined) {
                        included =
                            options.includedExtensions.includes(
                                direntExtension,
                            );
                    }

                    if (included && options.excludedExtensions !== undefined) {
                        included =
                            !options.excludedExtensions.includes(
                                direntExtension,
                            );
                    }
                    return included;
                });
                files.push(...dirFiles);
            }

            if (options.recursive && parentDirectory.directories) {
                for (const dir of parentDirectory.directories) {
                    recursion(dir);
                }
            }
        };
        recursion(directory);
        return files;
    }

    async listFileNames(
        directory: Directory,
        options: {
            recursive: boolean;
            relative: boolean;
            includedExtensions?: string[];
            excludedExtensions?: string[];
        },
    ): Promise<string[]> {
        let files: File[] = await this.listFiles(directory, {
            recursive: options.recursive,
            excludedExtensions: options.excludedExtensions,
            includedExtensions: options.includedExtensions,
        });

        let fileNames: string[] = files.map<string>(
            (file) => file.parentPath + file.name,
        );

        if (options.relative) {
            const normalizedDirPathLength = (
                directory.parentPath + directory.name
            ).length;
            fileNames = fileNames.map((file) =>
                file.substring(normalizedDirPathLength + 1),
            );
        }

        return fileNames.sort();
    }

    async getRemoteTree(forceRefresh?: boolean): Promise<Directory> {
        if (!this.remoteTree || forceRefresh) {
            this.remoteTree = await this.ftp.getTree();
        }
        return this.remoteTree;
    }

    disposeRemoteTree(): void {
        this.remoteTree = undefined;
    }

    async getLocalTree(
        dirPath: string,
        forceRefresh?: boolean,
    ): Promise<Directory> {
        let localTree: Directory = this.localTreeMap.get(dirPath);
        if (!localTree || forceRefresh) {
            localTree = await this.io.getTree(dirPath);
            this.localTreeMap.set(dirPath, localTree);
        }
        return localTree;
    }

    disposeLocalTree(dirPath: string): void {
        this.localTreeMap.delete(dirPath);
    }
}
