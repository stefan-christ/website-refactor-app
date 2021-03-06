import { Inject, Injectable } from '@nestjs/common';

import { AppConfig, APP_CONFIG } from '../../app-config';
import { Quit } from '../../quit-exception';
import { CliService, Option, OPTION_QUIT } from '../cli/cli.service';
import { Directory, File, Tree } from '../file-provider/file-model';
import { FileProviderService } from '../file-provider/file-provider.service';
import { ReportService } from '../report/report.service';
import { Replacer } from './replacer';

enum RefactorCommand {
    DryRun = 'dry run',
    WetRun = 'wet run',
    CheckConditions = 'check conditions',
}

const MENU_NAME = 'REFACTOR MENU';

@Injectable()
export class RefactorService {
    private reportOperations: string;
    private reportErrors: string;

    private replacer: Replacer;

    private currentMediaFolder?: string;

    constructor(
        @Inject(APP_CONFIG) private readonly configuration: AppConfig,
        private readonly fileProvider: FileProviderService,
        private readonly report: ReportService,
        private readonly cli: CliService,
    ) {
        this.replacer = new Replacer(
            configuration.tweaking.filenameCharacters,
            configuration.tweaking.validLeadSequences,
            configuration.tweaking.validTrailSequences,
        );
    }

    private async getMediaFileNames(
        tree: Directory,
        mediaFolder: string,
        excludedExtensions: string[],
    ): Promise<string[]> {
        const mediaDirectory = tree.directories?.find(
            (dir) => dir.name === mediaFolder,
        );
        if (!mediaDirectory) {
            throw new Error('media folder does not exist');
        }

        const mediaFiles = await this.fileProvider.listFileNames(
            mediaDirectory,
            {
                recursive: true,
                relative: true,
                excludedExtensions,
            },
        );

        if (mediaFiles.length === 0) {
            throw new Error('no matching files found in media folder.');
        }
        return mediaFiles;
    }

    private async refactorSourceFiles(
        tree: Tree,
        mediaFolder: string,
        command: RefactorCommand,
    ): Promise<void> {
        const excludedExtensions: string[] =
            !this.configuration.refactor.replacementExclusionFileTypes ||
            this.configuration.refactor.replacementExclusionFileTypes.length ===
                0
                ? undefined
                : this.configuration.refactor.replacementExclusionFileTypes;

        let mediaFiles: string[];
        try {
            mediaFiles = await this.getMediaFileNames(
                tree,
                mediaFolder,
                excludedExtensions,
            );
        } catch (error) {
            await this.cli.prompt(error.message);
            return;
        }

        const sourceFiles = (
            await this.fileProvider.listFiles(tree, {
                recursive: true,
                includedExtensions: this.configuration.refactor.sourceFileTypes,
            })
        ).filter((sourceFile) => {
            const filePath = this.fileProvider.relativePath(sourceFile, tree);
            return !filePath.startsWith(mediaFolder + tree.pathSeparator);
        });

        if (sourceFiles.length === 0) {
            await this.cli.prompt(
                'no matching source files found in source directory.',
            );
            return;
        }

        this.reportErrors = '';
        this.reportOperations = '';

        let mediaFilenameError: string = '';

        mediaFiles.forEach((mediaFile) => {
            let problems: string[] = [];
            for (let index = 0; index < mediaFile.length; index++) {
                const character = mediaFile.substring(index, index + 1);
                if (
                    !this.configuration.tweaking.filenameCharacters.includes(
                        character.toLowerCase(),
                    )
                ) {
                    problems.push(character);
                }
            }
            if (problems.length > 0) {
                mediaFilenameError +=
                    mediaFile +
                    ' contains the character(s)\n   ' +
                    problems.map((p) => `'${p}'`).join('\n   ') +
                    '\n';
            }
        });

        if (!!mediaFilenameError) {
            this.writeError(
                'Error(s) in media file name(s).\n\n',
                mediaFilenameError,
            );
        }

        await this.replaceMediaReferences(
            tree,
            command,
            mediaFolder,
            mediaFiles,
            sourceFiles,
        );

        let reportName: string;
        switch (command) {
            case RefactorCommand.CheckConditions:
                reportName = 'refactor-conditions-check';
                break;
            case RefactorCommand.DryRun:
                reportName = 'refactor-dry-run';
                break;
            case RefactorCommand.WetRun:
                reportName = 'refactor-wet-run';
                break;

            default:
                throw new Error('unknown command ' + command);
        }

        let ts = '';
        if (this.configuration.timestamp === 'file') {
            ts = this.report.getTimestamp() + ' ';
        }

        if (!this.reportOperations) {
            this.reportOperations = 'no operations';
        }
        await this.report.writeTextReport(
            this.reportOperations,
            `${ts}${reportName} operations.log`,
        );

        if (!this.reportErrors) {
            this.reportErrors = 'no errors';
        }
        await this.report.writeTextReport(
            this.reportErrors,
            `${ts}${reportName} errors.log`,
        );
    }

    private writeError(...params: string[]): void {
        console.error(...params);
        this.reportErrors += params.join(' ') + '\n';
    }
    private writeOperation(detail: boolean, ...params: string[]): void {
        if (!detail || this.configuration.verboseLogging) {
            console.log(...params);
        }
        this.reportOperations += params.join(' ') + '\n';
    }

    private async replaceMediaReferences(
        tree: Tree,
        command: RefactorCommand,
        mediaDirName: string,
        mediaFiles: string[],
        sourceFiles: File[],
    ): Promise<void> {
        let counter = 0;
        const total = sourceFiles.length;

        this.replacer.problemCallback = (fileName, token, problem, snippet) => {
            this.writeError(' ');
            this.writeError('checking source:', fileName);
            this.writeError('media file:', token);
            this.writeError('problem:', problem);
            this.writeError('snippet:', snippet);
        };

        for (const sourceFile of sourceFiles) {
            const relativeFilePath = this.fileProvider.relativePath(
                sourceFile,
                tree,
            );

            counter++;
            this.writeOperation(
                false,
                counter + ' of ' + total + ' ??? checking source: ',
                relativeFilePath,
            );

            const source = await this.fileProvider.loadSourceFile(sourceFile);
            if (!source) {
                continue;
            }

            this.replacer.init(relativeFilePath, source);
            let fileLog = '';

            for (const mediaFile of mediaFiles) {
                const replacement = mediaDirName + '/' + mediaFile;
                this.replacer.setToken(mediaFile);
                let tokenReplaceCount = 0;
                while (this.replacer.hasMore()) {
                    if (command === RefactorCommand.CheckConditions) {
                        continue;
                    }
                    tokenReplaceCount++;
                    this.replacer.replaceWith(replacement);
                }
                if (tokenReplaceCount > 0) {
                    fileLog +=
                        '   ' + tokenReplaceCount + ' x ' + mediaFile + '\n';
                }
            }

            if (fileLog) {
                this.writeOperation(true, fileLog);
                fileLog = undefined;
            } else {
                this.writeOperation(true, '   untouched');
            }

            if (
                this.replacer.changes() > 0 &&
                command === RefactorCommand.WetRun
            ) {
                // save the file
                await this.fileProvider.saveSourceFile(
                    sourceFile,
                    this.replacer.getData(),
                );
            }
        }
    }

    async validateConfig(): Promise<boolean> {
        if (!this.configuration.refactor) {
            await this.cli.prompt(
                'Refactoring not yet set up in configuration.json',
            );
            return false;
        }
        if (
            !this.configuration.refactor.sourceFileTypes ||
            !Array.isArray(this.configuration.refactor.sourceFileTypes) ||
            this.configuration.refactor.sourceFileTypes.length === 0
        ) {
            await this.cli.prompt(
                'Refactoring not set up properly in configuration.json.\nYou have to specify at least one source file type.',
            );
            return false;
        }
        return true;
    }

    async showMainMenu(origin: string): Promise<void> {
        let tree = await this.fileProvider.getSafeLocalTree(MENU_NAME);
        if (!tree) {
            return;
        }

        let mediaFolder = this.currentMediaFolder;
        if (!!mediaFolder) {
            mediaFolder = await this.requestMediaFolder(tree);
        }

        do {
            if (!mediaFolder) {
                mediaFolder = await this.requestMediaFolder(tree);
            }
            if (!mediaFolder) {
                return;
            }
            this.currentMediaFolder = mediaFolder;
            if (!!this.currentMediaFolder) {
                let command: RefactorCommand | 'choose folder' =
                    await this.requestCommand(this.currentMediaFolder, origin);
                if (command === undefined) {
                    return;
                }
                if (command === 'choose folder') {
                    mediaFolder = undefined;
                    tree = await this.fileProvider.getSafeLocalTree(MENU_NAME);
                } else {
                    await this.refactorSourceFiles(
                        tree,
                        this.currentMediaFolder,
                        command,
                    );
                }
            }
        } while (true);
    }

    private async requestCommand(
        mediaFolder: string,
        origin: string,
    ): Promise<RefactorCommand | 'choose folder' | undefined> {
        const optionCheckConditions: Option = {
            answer: 'Check conditions',
            choice: '1',
        };
        const optionDryRun: Option = {
            answer: 'Dry Run (no changes will be made)',
            choice: '2',
        };
        const optionWetRun: Option = {
            answer: 'Wet Run (file contents are edited) CAUTION!',
            choice: '3',
        };
        const optionChooseMediaFolder: Option = {
            answer:
                'Choose a different media folder (current: ' +
                mediaFolder +
                ')',
            choice: 'M',
        };
        const optionGoBack = this.cli.getOptionGoBack(origin);

        do {
            const optionFileMenu = this.fileProvider.optionFileMenu;

            const option = await this.cli.choose(
                MENU_NAME,
                // `Choose an action to perform on media folder '${mediaFolder}'?`,
                undefined,
                [
                    optionCheckConditions,
                    optionDryRun,
                    optionWetRun,
                    undefined,
                    optionChooseMediaFolder,
                    undefined,
                    optionFileMenu,
                    optionGoBack,
                    OPTION_QUIT,
                ],
            );

            switch (option) {
                case optionCheckConditions.answer:
                    return RefactorCommand.CheckConditions;
                case optionDryRun.answer:
                    return RefactorCommand.DryRun;
                case optionWetRun.answer:
                    return RefactorCommand.WetRun;
                case optionChooseMediaFolder.answer:
                    return 'choose folder';

                case optionFileMenu.answer:
                    await this.fileProvider.showFileMenu({
                        origin: MENU_NAME,
                        disallowFtp: true,
                    });
                    const tree = await this.fileProvider.getCurrentTree();
                    if (
                        !this.fileProvider.doesMediaFolderExist(
                            tree,
                            mediaFolder,
                        )
                    ) {
                        this.cli.prompt(
                            `Media folder '${mediaFolder}' does not exist in this file source.`,
                        );
                        return 'choose folder';
                    }
                    break;
                case optionGoBack.answer:
                    return undefined;
                case OPTION_QUIT.answer:
                    throw Quit;
                default:
                    return undefined;
            }
        } while (true);
    }

    private async requestMediaFolder(tree: Tree): Promise<string | undefined> {
        let mediaFolder: string;

        do {
            mediaFolder = await this.cli.request(
                'Enter name of a media folder located in the current root directory',
            );
            if (!mediaFolder) {
                return undefined;
            } else {
                try {
                    if (
                        !this.fileProvider.doesMediaFolderExist(
                            tree,
                            mediaFolder,
                        )
                    ) {
                        throw new Error(
                            `Media folder '${mediaFolder}' does not exist.`,
                        );
                    }
                } catch (error) {
                    this.cli.prompt(error.message);
                    mediaFolder = undefined;
                }
            }
        } while (!mediaFolder);

        return mediaFolder;
    }
}
