import { Inject, Injectable } from '@nestjs/common';

import { AnalyzerService } from './services/analyzer/analyzer.service';
import { CliService } from './services/cli/cli.service';
import { CONFIG, Configuration } from './services/configuration/configuration';
import { FtpAnalyzerService } from './services/ftp-analyzer/ftp-analyzer.service';
import { IoService } from './services/io/io.service';
import { Quit } from './services/quit-exception';
import { RefactorService } from './services/refactorer/refactorer.service';

@Injectable()
export class AppService {
    constructor(
        @Inject(CONFIG) private readonly config: Configuration,
        private readonly analyzerService: AnalyzerService,
        private readonly refactorService: RefactorService,
        private readonly ftpAnalyzerService: FtpAnalyzerService,
        private readonly io: IoService,
        private readonly cli: CliService,
    ) {}

    async startup(): Promise<void> {
        if (!(await this.validateConfig())) {
            return;
        }

        return this.showMainMenu();
    }

    private async validateConfig(): Promise<boolean> {
        if (!this.io.pathExists(this.config.wwwDir)) {
            this.cli.prompt(
                'The www dir path of your configuration could not be resolved.',
            );
            return false;
        }
        if (!this.io.pathExists(this.config.workingDir)) {
            this.cli.prompt(
                'The working dir path of your configuration could not be resolved.',
            );
            return false;
        }
        return true;
    }

    private async showMainMenu(): Promise<void> {
        const optionRefactorSourceFiles = 'refactor source files';
        const optionAnalyzeFileTypesWww = 'analyze file types (www dir)';
        const optionAnalyzeFileTypesCustom = 'analyze file types (custom dir)';
        const optionAnalyzeFtpFiles = 'analyze FTP files';
        const optionDetectFileEncodings = 'detect file enccodings';
        const optionQuit = 'quit';

        do {
            const option = await this.cli.choose(
                'Which action do you want to perform?',
                [
                    optionRefactorSourceFiles,
                    optionAnalyzeFileTypesWww,
                    optionAnalyzeFileTypesCustom,
                    optionAnalyzeFtpFiles,
                    optionDetectFileEncodings,
                    optionQuit,
                ],
            );

            switch (option) {
                case optionRefactorSourceFiles:
                    if (!(await this.refactorService.validateConfig())) {
                        return;
                    }
                    await this.refactorService.showMainMenu();
                    break;
                case optionAnalyzeFileTypesWww:
                    await this.analyzerService.showMainMenu('www');
                    break;
                case optionAnalyzeFileTypesCustom:
                    await this.analyzerService.showMainMenu('custom');
                    break;
                case optionAnalyzeFtpFiles:
                    await this.ftpAnalyzerService.showMainMenu();
                    break;
                case optionDetectFileEncodings:
                    await this.ftpAnalyzerService.showMainMenu();
                    break;
                default:
                    throw Quit;
            }
        } while (true);
    }
}
