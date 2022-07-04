import { Inject, Injectable } from '@nestjs/common';

import ced from 'ced';
import { AppConfig, APP_CONFIG } from '../../app-config';
import { Quit } from '../../quit-exception';
import { CliService, Option, OPTION_QUIT } from '../cli/cli.service';
import { Directory, File, Link } from '../file-provider/file-model';
import { FileProviderService } from '../file-provider/file-provider.service';
import { ReportService } from '../report/report.service';

const MENU_NAME = 'ANALYZER MENU';

type Encoding =
    | 'UTF-8'
    | 'UTF-32BE'
    | 'UTF-32LE'
    | 'UTF-16BE'
    | 'UTF-16LE'
    | 'Windows-1252'
    | 'ISO-8859-1'
    | 'unclear';

@Injectable()
export class AnalyzerService {
    constructor(
        @Inject(APP_CONFIG) private readonly configuration: AppConfig,
        private readonly fileProvider: FileProviderService,
        private readonly report: ReportService,
        private readonly cli: CliService,
    ) {}

    async showMainMenu(origin: string): Promise<void> {
        const optionNonRecursively: Option = {
            answer: 'file types (non-recursive)',
            choice: '1',
        };
        const optionRecursively: Option = {
            answer: 'file types (recursive)', //
            choice: '2',
        };
        const optionFindCaseConflicts: Option = {
            answer: 'case conflicts',
            choice: '3',
        };
        const optionFindSymbolicLinks: Option = {
            answer: 'symbolic links',
            choice: '4',
        };
        const optionFindProblematicCharacters: Option = {
            answer: 'problematic file name characters',
            choice: '5',
        };
        const optionDetectFileEncodings: Option = {
            answer: 'detect file encodings (not on FTP)',
            choice: '6',
        };
        const optionWriteTreeFile: Option = {
            answer: 'file tree',
            choice: '7',
        };

        const optionAll: Option = {
            answer: 'all of the above',
            choice: 'A',
        };

        const optionGoBack = this.cli.getOptionGoBack(origin);

        const optionFileMenu = this.fileProvider.optionFileMenu;

        const options: Option[] = [
            optionNonRecursively,
            optionRecursively,
            optionFindCaseConflicts,
            optionFindSymbolicLinks,
            optionFindProblematicCharacters,
            optionDetectFileEncodings,
            optionWriteTreeFile,
            undefined,
            optionAll,
            undefined,
            optionFileMenu,
            optionGoBack,
            OPTION_QUIT,
        ];

        do {
            let ts = '';
            if (this.configuration.timestamp === 'file') {
                ts = this.report.getTimestamp() + ' ';
            }

            const option = await this.cli.choose(MENU_NAME, undefined, options);
            let optionsToPerform: string[] = [];
            if (option === optionAll.answer) {
                optionsToPerform.push(
                    ...[
                        optionNonRecursively.answer,
                        optionRecursively.answer,
                        optionFindCaseConflicts.answer,
                        optionFindSymbolicLinks.answer,
                        optionFindProblematicCharacters.answer,
                        optionWriteTreeFile.answer,
                    ],
                );
                if (this.fileProvider.getCurrentType() !== 'ftp') {
                    optionsToPerform.push(optionDetectFileEncodings.answer);
                }
            } else {
                optionsToPerform.push(option);
            }

            for (const optionToPerform of optionsToPerform) {
                switch (optionToPerform) {
                    case optionWriteTreeFile.answer:
                        await this.writeTreeFile(ts);
                        break;
                    case optionNonRecursively.answer:
                        await this.analyzeFileTypes(ts, false);
                        break;
                    case optionRecursively.answer:
                        await this.analyzeFileTypes(ts, true);
                        break;

                    case optionFindCaseConflicts.answer:
                        await this.findCaseConflicts(ts);
                        break;
                    case optionFindSymbolicLinks.answer:
                        await this.findSymbolicLinkConflicts(ts);
                        break;
                    case optionFindProblematicCharacters.answer:
                        await this.findProblematicCharacters(ts);
                        break;
                    case optionDetectFileEncodings.answer:
                        await this.detectFileEncodings(ts);
                        break;

                    case optionFileMenu.answer:
                        await this.fileProvider.showFileMenu({
                            origin: MENU_NAME,
                        });
                        break;
                    case optionGoBack.answer:
                        return;
                    case OPTION_QUIT.answer:
                        throw Quit;
                    default:
                        return;
                }
            }
        } while (true);
    }

    private async writeTreeFile(timestamp: string): Promise<void> {
        const tree = await this.fileProvider.getCurrentTree();
        await this.report.writeJsonReport(
            tree,
            timestamp + 'analyzer-file-tree.json',
        );
    }

    private async analyzeFileTypes(
        timestamp: string,
        recursive: boolean,
    ): Promise<void> {
        const operation = `${timestamp}analyzer-file-types${
            recursive ? '' : '-non'
        }-recursive`;

        const tree = await this.fileProvider.getCurrentTree();
        const types = this.fileProvider.getFileExtensionList(tree, recursive);

        await this.report.writeJsonReport(types, `${operation}.json`);
        console.log('file types in root', types);

        await this.report.prepareDirectory(operation);

        for (let index = 0; index < types.length; index++) {
            const type = types[index];
            const fileIndex = `${index + 1}`.padStart(2, '0');
            const fileNameList = await this.fileProvider.listFileNames(tree, {
                recursive,
                relative: true,
                includedExtensions: [type],
            });

            const fileTypeName =
                type === '' ? 'no extension' : type.substring(1);
            await this.report.writeJsonReport(
                fileNameList,
                operation, // sub directory
                `${fileIndex}-${fileTypeName}.json`,
            );
        }
    }

    private async findCaseConflicts(timestamp: string): Promise<void> {
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

        await this.report.writeTextReport(
            report,
            `${timestamp}analyzer-case-conflichts.md`,
        );
    }

    private async detectFileEncodings(timestamp: string): Promise<void> {
        const tree = await this.fileProvider.getSafeLocalTree(MENU_NAME);
        if (!tree) {
            return;
        }

        const sourceFiles = await this.fileProvider.listFiles(tree, {
            recursive: true,
            includedExtensions: this.configuration.refactor.sourceFileTypes,
        });

        let encoding: string | undefined;
        const result: Record<string, string[]> = {};

        for (const sourceFile of sourceFiles) {
            const dataBuffer = await this.fileProvider.loadSourceFileAsBuffer(
                sourceFile,
            );

            const detected = ced(dataBuffer);

            encoding = detected;

            // if (detected === 'UTF8' || detected === 'ASCII-7-bit') {
            //     encoding = 'utf-8';
            // } else if (
            //     detected === 'CP1250' ||
            //     detected === 'CP1252' ||
            //     detected === 'Latin2'
            // ) {
            //     encoding = 'windows';
            // } else {
            //     encoding = detected;
            // }

            if (encoding) {
                if (!result[encoding]) {
                    result[encoding] = [];
                }
                const path = this.fileProvider.relativePath(sourceFile, tree);
                console.log(path, encoding);
                result[encoding].push(path);
            }
        }

        await this.report.writeJsonReport(
            result,
            `${timestamp}analyzer-file-encodings.json`,
        );
    }

    private async findProblematicCharacters(timestamp: string): Promise<void> {
        const tree = await this.fileProvider.getCurrentTree();
        let reportDirs = '';
        let reportFiles = '';

        const getProblematicCharacters = (name: string) => {
            let problematic: string[] = [];
            const nameLC = name.toLowerCase();
            for (let index = 0; index < nameLC.length; index++) {
                const charLC = nameLC.substring(index, index + 1);
                if (
                    !this.configuration.tweaking.filenameCharacters.includes(
                        charLC,
                    )
                ) {
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

        await this.report.writeTextReport(
            reportSummary,
            `${timestamp}analyzer-problematic-characters.md`,
        );
    }

    private async findSymbolicLinkConflicts(timestamp: string): Promise<void> {
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

        await this.report.writeTextReport(
            report,
            `${timestamp}analyzer-symbolic-links.md`,
        );
    }
}
