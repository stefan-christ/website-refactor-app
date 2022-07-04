import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, Configuration } from '../configuration/configuration';

import { CliService, Option, OPTION_QUIT } from '../cli/cli.service';
import { Directory } from '../file-provider/file-model';
import { FileProviderService } from '../file-provider/file-provider.service';
import { IoService } from '../io/io.service';
import { Quit } from '../quit-exception';
import { Replacer } from './replacer';

enum RefactorCommand {
    DryRun = 'dry run',
    WetRun = 'wet run',
    CheckConditions = 'check conditions',
}

@Injectable()
export class RefactorService {
    private reportOperations: string;
    private reportErrors: string;

    private replacer: Replacer;

    private currentMediaFolder?: string;

    constructor(
        @Inject(CONFIG) private readonly config: Configuration,
        private readonly fileProvider: FileProviderService,
        private readonly io: IoService,
        private readonly cli: CliService,
    ) {
        this.replacer = new Replacer(
            config.tweaking.filenameCharacters,
            config.tweaking.validLeadSequences,
            config.tweaking.validTrailSequences,
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
        mediaFolder: string,
        command: RefactorCommand,
    ): Promise<void> {
        const excludedExtensions: string[] =
            !this.config.refactor.replacementExclusionFileTypes ||
            this.config.refactor.replacementExclusionFileTypes.length === 0
                ? undefined
                : this.config.refactor.replacementExclusionFileTypes;

        const tree = await this.fileProvider.getWwwTree(true);
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
            await this.fileProvider.listFileNames(tree, {
                recursive: true,
                relative: true,
                includedExtensions: this.config.refactor.sourceFileTypes,
            })
        ).filter((fileName) => !fileName.startsWith(mediaFolder + this.io.sep));

        if (sourceFiles.length === 0) {
            await this.cli.prompt(
                'no matching source files found in www directory.',
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
                    !this.config.tweaking.filenameCharacters.includes(
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
            command,
            mediaFolder,
            mediaFiles,
            sourceFiles,
        );

        let reportDir: string;
        switch (command) {
            case RefactorCommand.CheckConditions:
                reportDir = 'refactor-condition-checks';
                break;
            case RefactorCommand.DryRun:
                reportDir = 'refactor-dry-runs';
                break;
            case RefactorCommand.WetRun:
                reportDir = 'refactor-wet-runs';
                break;

            default:
                break;
        }

        const reportDirPath = this.io.join(
            await this.fileProvider.getReportDirPath(),
            reportDir,
        );
        await this.io.ensureDirectory(reportDirPath);

        const ts = this.io.getTimestamp();

        if (!this.reportOperations) {
            this.reportOperations = 'no operations';
        }
        await this.io.writeTextFile(
            this.io.join(reportDirPath, `${ts} operations.log`),
            this.reportOperations,
        );

        if (!this.reportErrors) {
            this.reportErrors = 'no errors';
        }
        await this.io.writeTextFile(
            this.io.join(reportDirPath, `${ts} errors.log`),
            this.reportErrors,
        );
    }

    private writeError(...params: string[]): void {
        console.error(...params);
        this.reportErrors += params.join(' ') + '\n';
    }
    private writeOperation(detail: boolean, ...params: string[]): void {
        if (!detail || this.config.verboseLogging) {
            console.log(...params);
        }
        this.reportOperations += params.join(' ') + '\n';
    }

    private async replaceMediaReferences(
        command: RefactorCommand,
        mediaDirName: string,
        mediaFiles: string[],
        sourceFiles: string[],
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
            counter++;
            this.writeOperation(
                false,
                counter + ' of ' + total + ' — checking source: ',
                sourceFile,
            );

            const sourceFilePath = this.io.join(this.config.wwwDir, sourceFile);
            const source = await this.io.readTextFile(sourceFilePath);
            if (!source) {
                continue;
            }

            this.replacer.init(sourceFile, source);
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
                await this.io.writeTextFile(
                    sourceFilePath,
                    this.replacer.getData(),
                );
            }
        }
    }

    async validateConfig(): Promise<boolean> {
        if (!this.config.refactor) {
            await this.cli.prompt(
                'Refactoring not yet set up in configuration.json',
            );
            return false;
        }
        if (
            !this.config.refactor.sourceFileTypes ||
            !Array.isArray(this.config.refactor.sourceFileTypes) ||
            this.config.refactor.sourceFileTypes.length === 0
        ) {
            await this.cli.prompt(
                'Refactoring not set up properly in configuration.json.\nYou have to specify at least one source file type.',
            );
            return false;
        }
        return true;
    }

    async showMainMenu(origin: string): Promise<void> {
        let mediaFolder = this.currentMediaFolder;
        do {
            if (!mediaFolder) {
                mediaFolder = await this.requestMediaDirName();
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
                } else {
                    await this.refactorSourceFiles(
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
        const menuName = 'REFACTORER MENU';

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
                menuName,
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
                        origin: menuName,
                    });
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

    private async requestMediaDirName(): Promise<string | undefined> {
        let mediaDirName: string;

        do {
            mediaDirName = await this.cli.request(
                'Enter name of a media folder located in the current root directory',
            );
            if (!mediaDirName) {
                return undefined;
            } else {
                try {
                    const mediaDirPath = this.io.join(
                        this.config.wwwDir,
                        mediaDirName,
                    );
                    if (!this.io.pathExists(mediaDirPath)) {
                        throw new Error('path not exists');
                    }
                } catch (error) {
                    this.cli.prompt('The path could not be resolved.');
                    mediaDirName = undefined;
                }
            }
        } while (!mediaDirName);

        return mediaDirName;
    }
}
