import { Inject, Injectable } from '@nestjs/common';

import { CliService } from '../cli/cli.service';
import { CONFIG, Configuration } from '../configuration/configuration';
import { IoService } from '../io/io.service';
import { Quit } from '../quit-exception';

@Injectable()
export class AnalyzerService {
    constructor(
        @Inject(CONFIG) private readonly config: Configuration,
        private readonly io: IoService,
        private readonly cli: CliService,
    ) {}

    async showMainMenu(mode: 'www' | 'custom'): Promise<void> {
        const optionNonRecursively = 'non-recursive';
        const optionRecursively = 'recursive';
        const optionChoosePath = 'choose a different custom directory path';
        const optionGoBack = 'go back';
        const optionQuit = 'quit';

        let analysisFile: string;
        let options: string[];

        if (mode === 'www') {
            analysisFile = 'file-analysis-www-dir';
            options = [
                optionNonRecursively,
                optionRecursively,
                optionGoBack,
                optionQuit,
            ];
        } else {
            analysisFile = 'file-analysis-custom-dir';
            options = [
                optionNonRecursively,
                optionRecursively,
                optionChoosePath,
                optionGoBack,
                optionQuit,
            ];
        }

        let targetPath: string;

        do {
            if (mode === 'www') {
                targetPath = this.config.wwwDir;
            } else {
                if (!targetPath) {
                    targetPath = await this.requestDirectoryPath();
                    if (!targetPath) {
                        return;
                    }
                }
            }

            const option = await this.cli.choose(
                'Analyzing file types',
                options,
            );

            switch (option) {
                case optionNonRecursively:
                    await this.analyzeFileTypes(
                        targetPath,
                        analysisFile,
                        false,
                    );
                    break;
                case optionRecursively:
                    await this.analyzeFileTypes(
                        targetPath, //
                        analysisFile,
                        true,
                    );
                    break;
                case optionChoosePath:
                    targetPath = undefined;
                    break;
                case optionGoBack:
                    return;
                case optionQuit:
                    throw Quit;
                default:
                    return;
            }
        } while (true);
    }

    private async requestDirectoryPath(): Promise<string | undefined> {
        let requestedPath: string;

        do {
            requestedPath = await this.cli.request('Enter a directory path.');
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

    private async analyzeFileTypes(
        rootDirectoryPath: string,
        analysisFile: string,
        recursive: boolean,
    ): Promise<void> {
        const operation = `${analysisFile}${recursive ? '' : '-non'}-recursive`;

        const analysisFilePath = this.io.join(
            this.config.workingDir,
            `${operation}.json`,
        );

        const types = await this.io.getFileExtensionList(
            rootDirectoryPath,
            recursive,
        );

        await this.io.writeJsonFile(analysisFilePath, types);
        console.log('file types in root', types);

        const analysisDirPath = this.io.join(this.config.workingDir, operation);

        await this.io.rimraf(analysisDirPath);
        await this.io.ensureDirectory(analysisDirPath);

        for (let index = 0; index < types.length; index++) {
            const type = types[index];
            const fileIndex = `${index + 1}`.padStart(2, '0');
            const fileList = await this.io.listFiles(rootDirectoryPath, {
                recursive,
                relative: true,
                includedExtensions: [type],
            });
            const fileName = type === '' ? 'no extension' : type.substring(1);
            const jsonFile = this.io.join(
                analysisDirPath,
                `${fileIndex}-${fileName}.json`,
            );
            await this.io.writeJsonFile(jsonFile, fileList);
        }
    }
}
