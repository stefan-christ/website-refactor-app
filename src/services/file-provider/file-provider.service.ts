import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, APP_CONFIG } from '../../app-config';
import { Quit } from '../../quit-exception';
import { CliService, Option, OPTION_QUIT } from '../cli/cli.service';
import { FtpService } from '../ftp/ftp.service';
import { IoService } from '../io/io.service';
import { Directory, File, Tree } from './file-model';

@Injectable()
export class FileProviderService {
    private remoteTree?: Tree;
    private wwwTree?: Tree;
    private localTreeMap?: Map<string, Tree> = new Map();

    private currentTree?: Tree;
    private currentType?: 'ftp' | 'www' | string;

    constructor(
        @Inject(APP_CONFIG) private readonly configuration: AppConfig,
        private readonly cli: CliService,
        private readonly ftp: FtpService,
        private readonly io: IoService,
    ) {}

    private get currentTreeSource(): string {
        if (!!this.currentType) {
            switch (this.currentType) {
                case 'ftp':
                    return ' (current file source: FTP)';
                case 'www':
                    return ' (current file source: WWW directory)';
                default:
                    return ' (current file source: ' + this.currentType + ')';
            }
        }
        return '';
    }

    get optionFileMenu(): Option {
        let answer = 'File Menu' + this.currentTreeSource;
        return {
            answer,
            choice: 'F',
        };
    }

    getCurrentType(): string | undefined {
        return this.currentType;
    }

    async saveSourceFile(sourceFile: File, data: string): Promise<void> {
        const sourceFilePath = this.io.join(
            sourceFile.parentPath,
            sourceFile.name,
        );
        await this.io.writeTextFile(sourceFilePath, data);
    }

    async loadSourceFile(sourceFile: File): Promise<string> {
        const sourceFilePath = this.io.join(
            sourceFile.parentPath,
            sourceFile.name,
        );
        return this.io.readTextFile(sourceFilePath);
    }

    async loadSourceFileAsBuffer(sourceFile: File): Promise<Buffer> {
        const sourceFilePath = this.io.join(
            sourceFile.parentPath,
            sourceFile.name,
        );
        return this.io.readTextFileAsBuffer(sourceFilePath);
    }

    doesMediaFolderExist(tree: Tree, mediaFolder: string): boolean {
        const dir = tree.directories?.find((dir) => dir.name === mediaFolder);
        if (!dir) {
            return false;
        }
        const mediaFolderPath = this.io.join(dir.parentPath, dir.name);
        return this.io.pathExists(mediaFolderPath);
    }

    async getSafeLocalTree(origin: string): Promise<Tree | undefined> {
        if (this.currentType === 'ftp') {
            const fileMenuOption = this.optionFileMenu;
            const goBackOption = this.cli.getOptionGoBack(origin);
            const chosen = await this.cli.choose(
                'This command cannot be executed on FTP server.',
                'You can switch to a different file source.',
                [fileMenuOption, goBackOption, OPTION_QUIT],
            );
            if (!chosen) {
                return undefined;
            }
            switch (chosen) {
                case fileMenuOption.answer:
                    await this.showFileMenu({ origin, disallowFtp: true });
                    if (this.currentType === 'ftp') {
                        return undefined;
                    } else {
                        return this.currentTree;
                    }
                case goBackOption.answer:
                    return undefined;
                case OPTION_QUIT.answer:
                    throw Quit;

                default:
                    return undefined;
            }
        } else {
            return this.currentTree;
        }
    }

    async getCurrentTree(): Promise<Tree | undefined> {
        return this.currentTree;
    }

    async showFileMenu(menuOptions: {
        origin?: string;
        disallowFtp?: boolean;
    }): Promise<void> {
        const optionSelectFtp: Option = {
            answer: 'Select file source: FTP',
            choice: '',
        };
        const optionSelectWww: Option = {
            answer: 'Select file source: WWW directory',
            choice: '',
        };

        const options: Option[] = [];

        let choiceIndex = 0;
        if (!menuOptions.disallowFtp) {
            choiceIndex++;
            optionSelectFtp.choice = '' + choiceIndex;
            options.push(optionSelectFtp);
        }
        choiceIndex++;
        optionSelectWww.choice = '' + choiceIndex;
        options.push(optionSelectWww);

        const choiceOffset = options.length;
        let choice = choiceOffset;
        const customs = Array.from(this.localTreeMap.keys());
        for (const key of customs) {
            choice++;
            options.push({
                answer: `Select file source: custom directory '${key}'`,
                choice: `${choice}`,
            });
        }

        choice++;
        const optionSelectCustom: Option = {
            answer:
                customs.length > 0
                    ? 'Select file source: another custom directory'
                    : 'Select file source: custom directory',
            choice: `${choice}`,
        };

        options.push(optionSelectCustom);

        const optionReload: Option = {
            answer: 'Refresh' + this.currentTreeSource,
            choice: 'R',
        };
        if (this.currentTree) {
            options.push(undefined);
            options.push(optionReload);
        }
        options.push(undefined);
        let optionGoBack = this.cli.getOptionGoBack(menuOptions.origin);
        if (menuOptions.origin) {
            options.push(optionGoBack);
        }
        options.push(OPTION_QUIT);

        do {
            const answer = await this.cli.choose(
                'FILE MENU',
                undefined,
                options,
            );
            switch (answer) {
                case optionSelectFtp.answer:
                    this.currentTree = await this.getRemoteTree();
                    this.currentType = 'ftp';
                    return;
                case optionSelectWww.answer:
                    this.currentTree = await this.getWwwTree();
                    this.currentType = 'www';
                    return;
                case optionSelectCustom.answer:
                    const dir = await this.requestDirectoryPath();
                    if (!!dir) {
                        this.currentTree = await this.getLocalTree(dir);
                        this.currentType = dir;
                        return;
                    }
                    break;

                case optionReload.answer:
                    if (this.currentType === 'ftp') {
                        this.currentTree = await this.getRemoteTree(true);
                        return;
                    } else if (this.currentType === 'www') {
                        this.currentTree = await this.getWwwTree(true);
                        return;
                    } else if (!!this.currentType) {
                        this.currentTree = await this.getLocalTree(
                            this.currentType,
                            true,
                        );
                        return;
                    }
                    break;
                case optionGoBack.answer:
                    return;
                case OPTION_QUIT.answer:
                    throw Quit;

                default:
                    if (!!answer) {
                        let index =
                            options.findIndex(
                                (option) => option?.answer === answer,
                            ) - choiceOffset;
                        if (index >= 0) {
                            const key = customs[index];
                            this.currentTree = await this.getLocalTree(key);
                            this.currentType = key;
                            return;
                        }
                    }
                    break;
            }
        } while (true);
    }

    private async requestDirectoryPath(): Promise<string | undefined> {
        let requestedPath: string;

        do {
            requestedPath = await this.cli.request('Enter a directory path');
            if (!requestedPath) {
                return undefined;
            } else {
                try {
                    if (!this.io.pathExists(requestedPath)) {
                        throw new Error('path not exists');
                    }
                } catch (error) {
                    this.cli.prompt('The path could not be resolved.');
                    requestedPath = undefined;
                }
            }
        } while (!requestedPath);

        return requestedPath;
    }

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

        let filePaths: string[];

        if (options.relative) {
            filePaths = files.map((file) => this.relativePath(file, directory));
        } else {
            filePaths = files.map<string>(
                (file) => file.parentPath + file.name,
            );
        }

        return filePaths.sort();
    }

    relativePath(
        fileOrDirectory: File | Directory,
        rootDir: Directory,
    ): string {
        const path = fileOrDirectory.parentPath + fileOrDirectory.name;
        const rootPathLen = (rootDir.parentPath + rootDir.name).length;
        return path.substring(rootPathLen + 1);
    }

    private async getRemoteTree(forceRefresh?: boolean): Promise<Tree> {
        if (!this.remoteTree || forceRefresh) {
            this.remoteTree = await this.ftp.getTree();
        }
        return this.remoteTree;
    }

    private async getWwwTree(forceRefresh?: boolean): Promise<Tree> {
        if (!this.wwwTree || forceRefresh) {
            this.wwwTree = await this.io.getTree(this.configuration.wwwDir);
        }
        return this.wwwTree;
    }

    private async getLocalTree(
        dirPath: string,
        forceRefresh?: boolean,
    ): Promise<Tree> {
        let localTree: Tree = this.localTreeMap.get(dirPath);
        if (!localTree || forceRefresh) {
            localTree = await this.io.getTree(dirPath);
            this.localTreeMap.set(dirPath, localTree);
        }
        return localTree;
    }
}
