import { Inject, Injectable } from '@nestjs/common';
import { CliService } from '../cli/cli.service';
import { CONFIG, Configuration } from '../configuration/configuration';
import { Directory, File, Link } from '../file-provider/file-model';
import { FileProviderService } from '../file-provider/file-provider.service';
import { IoService } from '../io/io.service';
import { Quit } from '../quit-exception';

@Injectable()
export class FtpAnalyzerService {
    constructor(
        @Inject(CONFIG) private readonly config: Configuration,
        private readonly cli: CliService,
        private readonly io: IoService,
        private readonly fileProvider: FileProviderService,
    ) {}

    async showMainMenu(): Promise<void> {
        const optionWriteTreeFile = 'write tree file';
        const optionFindCaseConflicts = 'find case conflicts';
        const optionFindSymbolicLinks = 'find symbolic links';
        const optionFindProblematicCharacters = 'find problematic characters';
        const optionDisposeFileCache = 'dispose cached file info';
        const optionGoBack = 'go back';
        const optionQuit = 'quit';

        do {
            const option = await this.cli.choose('Analyzing FTP files', [
                optionWriteTreeFile,
                optionFindCaseConflicts,
                optionFindSymbolicLinks,
                optionFindProblematicCharacters,
                optionDisposeFileCache,
                optionGoBack,
                optionQuit,
            ]);

            switch (option) {
                case optionWriteTreeFile:
                    await this.writeTreeFile();
                    break;
                case optionFindCaseConflicts:
                    await this.findCaseConflicts();
                    break;
                case optionFindSymbolicLinks:
                    await this.findSymbolicLinkConflicts();
                    break;
                case optionFindProblematicCharacters:
                    await this.findProblematicCharacters();
                    break;
                case optionDisposeFileCache:
                    this.fileProvider.disposeRemoteTree();
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

    private async writeTreeFile(): Promise<void> {
        const tree = await this.fileProvider.getRemoteTree();
        const reportFilePath = this.io.join(
            this.config.workingDir,
            `file-tree-ftp.json`,
        );
        await this.io.writeJsonFile(reportFilePath, tree);
    }

    private async findCaseConflicts(): Promise<void> {
        const tree = await this.fileProvider.getRemoteTree();
        let reportFiles = '';
        let reportDirs = '';

        const findConflicts = (
            parentPath: string,
            hasName: { name: string }[],
        ): string => {
            if (!hasName) {
                return '';
            }

            const lowercaseNames = hasName.map((value) =>
                value.name.toLowerCase(),
            );
            const indexSkip: number[] = [];
            let report = '';
            for (let index = 0; index < hasName.length; index++) {
                if (indexSkip.includes(index)) {
                    continue;
                }
                const nameLC = hasName[index].name.toLowerCase();
                let pos: number = lowercaseNames.indexOf(nameLC, index + 1);
                if (pos !== -1) {
                    report += parentPath + hasName[index].name + '\n';

                    while (pos !== -1) {
                        report += parentPath + hasName[pos].name + '\n';
                        indexSkip.push(pos);
                        pos = lowercaseNames.indexOf(nameLC, pos + 1);
                    }
                    report += '\n';
                }
            }
            return report;
        };

        const analyzeCaseConflicts = (
            parentPath: string,
            files: File[] | undefined,
            dirs: Directory[] | undefined,
        ) => {
            //
            reportFiles += findConflicts(parentPath, files);
            reportDirs += findConflicts(parentPath, dirs);

            if (dirs) {
                for (const dir of dirs) {
                    analyzeCaseConflicts(
                        parentPath + dir.name + '/',
                        dir.files,
                        dir.directories,
                    );
                }
            }
        };

        analyzeCaseConflicts('/', tree.files, tree.directories);

        if (!reportFiles) {
            reportFiles += 'none\n';
        }
        if (!reportDirs) {
            reportDirs += 'none\n';
        }

        const report =
            '# Case Conflicts' +
            '\n\n## DIRECTORIES\n\n' +
            reportDirs +
            '\n\n## FILES\n\n' +
            reportFiles;

        const reportFilePath = this.io.join(
            this.config.workingDir,
            `ftp-case-conflichts.md`,
        );
        await this.io.writeTextFile(reportFilePath, report);
    }

    private async findProblematicCharacters(): Promise<void> {
        const tree = await this.fileProvider.getRemoteTree();
        let reportDirs = '';
        let reportFiles = '';

        const getProblematicCharacters = (name: string) => {
            let problematic: string[] = [];
            const nameLC = name.toLowerCase();
            for (let index = 0; index < nameLC.length; index++) {
                const charLC = nameLC.substring(index, index + 1);
                if (!this.config.tweaking.filenameCharacters.includes(charLC)) {
                    const char = name.substring(index, index + 1);
                    if (!problematic.includes(char)) {
                        problematic.push(char);
                    }
                }
            }
            return problematic.length === 0 ? undefined : problematic;
        };

        const analyzeCharacters = (
            parentPath: string,
            files: File[] | undefined,
            dirs: Directory[] | undefined,
        ) => {
            if (files) {
                for (const file of files) {
                    const problematic = getProblematicCharacters(file.name);
                    if (problematic) {
                        reportFiles += parentPath + file.name + '\n';
                        reportFiles +=
                            "   '" + problematic.join("'\n   ") + "'\n";
                    }
                }
            }
            if (dirs) {
                for (const dir of dirs) {
                    const problematic = getProblematicCharacters(dir.name);
                    if (problematic) {
                        // console.log('problematic');
                        reportDirs += parentPath + dir.name + '\n';
                        reportDirs +=
                            "   '" + problematic.join("'\n   ") + "'\n";
                    }

                    analyzeCharacters(
                        parentPath + dir.name + '/',
                        dir.files,
                        dir.directories,
                    );
                }
            }
        };

        analyzeCharacters('/', tree.files, tree.directories);

        if (!reportDirs) {
            reportDirs += 'none\n';
        }
        if (!reportFiles) {
            reportFiles += 'none\n';
        }
        const reportSummary =
            '# Problematic Characters' +
            '\n\n## DIRECTORIES\n\n' +
            reportDirs +
            '\n\n## FILES\n\n' +
            reportFiles;

        const reportPath = this.io.join(
            this.config.workingDir,
            `ftp-problematic-characters.md`,
        );
        await this.io.writeTextFile(reportPath, reportSummary);
    }

    private async findSymbolicLinkConflicts(): Promise<void> {
        const tree = await this.fileProvider.getRemoteTree();
        let report = '';

        const analyzeSymbolics = (
            parentPath: string,
            links: Link[] | undefined,
            dirs: Directory[] | undefined,
        ) => {
            if (links) {
                for (const link of links) {
                    report += parentPath + link.name + '\n';
                }
            }
            if (dirs) {
                for (const dir of dirs) {
                    analyzeSymbolics(
                        parentPath + dir.name + '/',
                        dir.links,
                        dir.directories,
                    );
                }
            }
        };

        analyzeSymbolics('/', tree.links, tree.directories);
        if (!report) {
            report += 'none\n';
        }
        report = '# Symbolic Link Conflicts\n\n' + report;

        const reportFilePath = this.io.join(
            this.config.workingDir,
            `ftp-symbolic-links.md`,
        );
        await this.io.writeTextFile(reportFilePath, report);
    }
}
