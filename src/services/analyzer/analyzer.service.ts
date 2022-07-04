import { Inject, Injectable } from '@nestjs/common';

import { CliService, Option, OPTION_QUIT } from '../cli/cli.service';
import { CONFIG, Configuration } from '../configuration/configuration';
import { Directory, File, Link } from '../file-provider/file-model';
import { FileProviderService } from '../file-provider/file-provider.service';
import { IoService } from '../io/io.service';
import { Quit } from '../quit-exception';

@Injectable()
export class AnalyzerService {
    constructor(
        @Inject(CONFIG) private readonly config: Configuration,
        private readonly fileProvider: FileProviderService,
        private readonly io: IoService,
        private readonly cli: CliService,
    ) {}

    async showMainMenu(origin: string): Promise<void> {
        const menuName = 'ANALYZER MENU';

        const optionWriteTreeFile: Option = {
            answer: 'write tree file',
            choice: '1',
        };
        const optionNonRecursively: Option = {
            answer: 'non-recursive',
            choice: '2',
        };
        const optionRecursively: Option = {
            answer: 'recursive', //
            choice: '3',
        };

        const optionFindCaseConflicts: Option = {
            answer: 'find case conflicts',
            choice: '4',
        };
        const optionFindSymbolicLinks: Option = {
            answer: 'find symbolic links',
            choice: '5',
        };
        const optionFindProblematicCharacters: Option = {
            answer: 'find problematic characters',
            choice: '6',
        };

        const optionDetectFileEncodings: Option = {
            answer: 'detect file encodings',
            choice: '7',
        };
        const optionGoBack = this.cli.getOptionGoBack(origin);

        const optionFileMenu = this.fileProvider.optionFileMenu;

        let treeFile: string;
        let analysisFile: string;
        const options: Option[] = [
            optionWriteTreeFile,
            optionNonRecursively,
            optionRecursively,
            optionFindCaseConflicts,
            optionFindSymbolicLinks,
            optionFindProblematicCharacters,
            optionDetectFileEncodings,
            undefined,
            optionFileMenu,
            optionGoBack,
            OPTION_QUIT,
        ];

        if (this.fileProvider.getCurrentType() === 'ftp') {
            analysisFile = 'file-analysis-remote-dir';
            treeFile = 'file-tree-remote-dir.json';
        } else if (this.fileProvider.getCurrentType() === 'www') {
            analysisFile = 'file-analysis-www-dir';
            treeFile = 'file-tree-www-dir.json';
        } else {
            analysisFile = 'file-analysis-custom-dir';
            treeFile = 'file-tree-custom-dir.json';
        }

        do {
            const option = await this.cli.choose(menuName, undefined, options);

            switch (option) {
                case optionWriteTreeFile.answer:
                    await this.writeTreeFile(treeFile);
                    break;
                case optionNonRecursively.answer:
                    await this.analyzeFileTypes(analysisFile, false);
                    break;
                case optionRecursively.answer:
                    await this.analyzeFileTypes(analysisFile, true);
                    break;

                case optionFindCaseConflicts.answer:
                    await this.findCaseConflicts();
                    break;
                case optionFindSymbolicLinks.answer:
                    await this.findSymbolicLinkConflicts();
                    break;
                case optionFindProblematicCharacters.answer:
                    await this.findProblematicCharacters();
                    break;
                case optionDetectFileEncodings.answer:
                    // await this.findProblematicCharacters();
                    break;

                case optionFileMenu.answer:
                    await this.fileProvider.showFileMenu({
                        origin: menuName,
                    });
                    break;
                case optionGoBack.answer:
                    return;
                case OPTION_QUIT.answer:
                    throw Quit;
                default:
                    return;
            }
        } while (true);
    }

    private async writeTreeFile(treeFile: string): Promise<void> {
        const tree = await this.fileProvider.getCurrentTree();
        const reportFilePath = this.io.join(
            await this.fileProvider.getReportDirPath(),
            treeFile,
        );
        await this.io.writeJsonFile(reportFilePath, tree);
    }

    private async analyzeFileTypes(
        analysisFile: string,
        recursive: boolean,
    ): Promise<void> {
        const operation = `${analysisFile}${recursive ? '' : '-non'}-recursive`;

        const analysisFilePath = this.io.join(
            await this.fileProvider.getReportDirPath(),
            `${operation}.json`,
        );

        const tree = await this.fileProvider.getCurrentTree();

        const types = this.fileProvider.getFileExtensionList(tree, recursive);

        await this.io.writeJsonFile(analysisFilePath, types);
        console.log('file types in root', types);

        const analysisDirPath = this.io.join(
            await this.fileProvider.getReportDirPath(),
            operation,
        );

        await this.io.rimraf(analysisDirPath);
        await this.io.ensureDirectory(analysisDirPath);

        for (let index = 0; index < types.length; index++) {
            const type = types[index];
            const fileIndex = `${index + 1}`.padStart(2, '0');
            const fileList = await this.fileProvider.listFileNames(tree, {
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

    private async findCaseConflicts(): Promise<void> {
        const tree = await this.fileProvider.getCurrentTree();
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
            await this.fileProvider.getReportDirPath(),
            `case-conflichts.md`,
        );
        await this.io.writeTextFile(reportFilePath, report);
    }

    private async findProblematicCharacters(): Promise<void> {
        const tree = await this.fileProvider.getCurrentTree();
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
            await this.fileProvider.getReportDirPath(),
            `problematic-characters.md`,
        );
        await this.io.writeTextFile(reportPath, reportSummary);
    }

    private async findSymbolicLinkConflicts(): Promise<void> {
        const tree = await this.fileProvider.getCurrentTree();
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
            await this.fileProvider.getReportDirPath(),
            `symbolic-links.md`,
        );
        await this.io.writeTextFile(reportFilePath, report);
    }
}
