import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, Configuration } from '../configuration/configuration';

import { CliService } from '../cli/cli.service';
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
        mediaDirName: string,
        excludedExtensions: string[],
    ): Promise<string[]> {
        const mediaDir = tree.directories?.find(
            (dir) => dir.name === mediaDirName,
        );
        if (!mediaDir) {
            throw new Error('media dir does not exist');
        }

        const mediaFiles = await this.fileProvider.listFileNames(mediaDir, {
            recursive: true,
            relative: true,
            excludedExtensions,
        });

        if (mediaFiles.length === 0) {
            throw new Error(
                'no matching media files found in media directory.',
            );
        }
        return mediaFiles;
    }

    private async refactorSourceFiles(
        mediaDirName: string,
        command: RefactorCommand,
    ): Promise<void> {
        const excludedExtensions: string[] =
            !this.config.refactor.replacementExclusionFileTypes ||
            this.config.refactor.replacementExclusionFileTypes.length === 0
                ? undefined
                : this.config.refactor.replacementExclusionFileTypes;

        const tree = await this.fileProvider.getLocalTree(
            this.config.wwwDir,
            true,
        );
        let mediaFiles: string[];
        try {
            mediaFiles = await this.getMediaFileNames(
                tree,
                mediaDirName,
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
        ).filter(
            (fileName) => !fileName.startsWith(mediaDirName + this.io.sep),
        );

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
            mediaDirName,
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

        const reportDirPath = this.io.join(this.config.workingDir, reportDir);
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

    async showMainMenu(): Promise<void> {
        let mediaDirName: string;
        do {
            if (!mediaDirName) {
                mediaDirName = await this.requestMediaDirName();
            }
            if (!mediaDirName) {
                return;
            }
            if (!!mediaDirName) {
                let command: RefactorCommand | 'choose dir' =
                    await this.requestCommand(mediaDirName);
                if (command === undefined) {
                    return;
                }
                if (command === 'choose dir') {
                    mediaDirName = undefined;
                } else {
                    await this.refactorSourceFiles(mediaDirName, command);
                }
            }
        } while (true);
    }

    private async requestCommand(
        mediaDirName: string,
    ): Promise<RefactorCommand | 'choose dir' | undefined> {
        const optionCheckConditions = 'check conditions';
        const optionDryRun = 'dry run (no changes will be made)';
        const optionWetRun = 'wet run (file contents are edited) CAUTION!';
        const optionChooseDir = 'choose a different dir name';
        const optionBack = 'back';
        const optionQuit = 'quit';

        do {
            const option = await this.cli.choose(
                'Choose an action to perform on dir ' + mediaDirName + '?',
                [
                    optionCheckConditions,
                    optionDryRun,
                    optionWetRun,
                    optionChooseDir,
                    optionBack,
                    optionQuit,
                ],
            );

            switch (option) {
                case optionCheckConditions:
                    return RefactorCommand.CheckConditions;
                case optionDryRun:
                    return RefactorCommand.DryRun;
                case optionWetRun:
                    return RefactorCommand.WetRun;
                case optionChooseDir:
                    return 'choose dir';
                case optionBack:
                    return undefined;
                case optionQuit:
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
                'Enter a media dir name inside the www dir.',
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
