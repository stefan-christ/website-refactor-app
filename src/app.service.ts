import { Inject, Injectable } from '@nestjs/common';

import { AnalyzerService } from './services/analyzer/analyzer.service';
import { CliService, Option, OPTION_QUIT } from './services/cli/cli.service';
import {
    CONFIGURATION,
    Configuration,
} from './services/configuration/configuration';
import { FileProviderService } from './services/file-provider/file-provider.service';
import { IoService } from './services/io/io.service';
import { Quit } from './quit-exception';
import { RefactorService } from './services/refactorer/refactorer.service';

@Injectable()
export class AppService {
    constructor(
        @Inject(CONFIGURATION) private readonly configuration: Configuration,
        private readonly analyzerService: AnalyzerService,
        private readonly refactorService: RefactorService,
        private readonly fileProvider: FileProviderService,
        private readonly io: IoService,
        private readonly cli: CliService,
    ) {}

    async startup(): Promise<void> {
        if (!(await this.validateConfig())) {
            return;
        }

        await this.fileProvider.showFileMenu({});
        if (!(await this.fileProvider.getCurrentTree())) {
            throw Quit;
        }
        return this.showMainMenu();
    }

    private async validateConfig(): Promise<boolean> {
        if (!this.io.pathExists(this.configuration.wwwDir)) {
            this.cli.prompt(
                'The www dir path of your configuration could not be resolved.',
            );
            return false;
        }
        if (!this.io.pathExists(this.configuration.workingDir)) {
            this.cli.prompt(
                'The working dir path of your configuration could not be resolved.',
            );
            return false;
        }
        return true;
    }

    private async showMainMenu(): Promise<void> {
        const menuName = 'MAIN MENU';
        const optionRefactorSourceFiles: Option = {
            answer: 'Refactor Menu',
            choice: '1',
        };
        const optionAnalyzeFileTypes: Option = {
            answer: 'Analyzer Menu',
            choice: '2',
        };
        const optionFileMenu = this.fileProvider.optionFileMenu;

        do {
            const option = await this.cli.choose(menuName, undefined, [
                optionRefactorSourceFiles,
                optionAnalyzeFileTypes,
                undefined,
                optionFileMenu,
                OPTION_QUIT,
            ]);

            switch (option) {
                case optionRefactorSourceFiles.answer:
                    if (!(await this.refactorService.validateConfig())) {
                        return;
                    }
                    await this.refactorService.showMainMenu(menuName);
                    break;
                case optionAnalyzeFileTypes.answer:
                    await this.analyzerService.showMainMenu(menuName);
                    break;
                case optionFileMenu.answer:
                    await this.fileProvider.showFileMenu({
                        origin: 'FILE MENU',
                    });
                    break;
                default:
                    throw Quit;
            }
        } while (true);
    }
}
