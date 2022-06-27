import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import sftp from 'ssh2-sftp-client';
import { CliService } from '../cli/cli.service';
import { CONFIG, Configuration } from '../configuration/configuration';
import { IoService } from '../io/io.service';
import { Quit } from '../quit-exception';

export interface File {
    name: string;
}
export interface Directory {
    name: string;
    directories?: Directory[];
    files?: File[];
    links?: File[];
}

export interface Tree {
    directories?: Directory[];
    files?: File[];
    links?: File[];
}

type Client = sftp;

@Injectable()
export class FtpService implements OnModuleDestroy {
    private _client: Client;
    private tree?: Tree;

    constructor(
        @Inject(CONFIG) private readonly config: Configuration,
        private readonly cli: CliService,
        private readonly io: IoService,
    ) {}

    async onModuleDestroy(): Promise<void> {
        return this.closeClient();
    }

    async showMainMenu(): Promise<void> {
        const optionFindCaseConflicts = 'find case conflicts';
        const optionFindSymbolicLinks = 'find symbolic links';
        const optionFindProblematicCharacters = 'find problematic characters';
        const optionDisposeFileCache = 'dispose cached file info';
        const optionGoBack = 'go back';
        const optionQuit = 'quit';

        do {
            let client = await this.getClient();

            if (!client) {
                return;
            }

            const option = await this.cli.choose('Analyzing FTP files', [
                optionFindCaseConflicts,
                optionFindSymbolicLinks,
                optionFindProblematicCharacters,
                optionDisposeFileCache,
                optionGoBack,
                optionQuit,
            ]);

            switch (option) {
                case optionFindCaseConflicts:
                    await this.findCaseConflicts(client);
                    break;
                case optionFindSymbolicLinks:
                    await this.findSymbolicLinkConflicts(client);
                    break;
                case optionFindProblematicCharacters:
                    await this.findProblematicCharacters(client);
                    break;
                case optionDisposeFileCache:
                    this.tree = undefined;
                    break;

                case optionGoBack:
                    await this.closeClient();
                    return;
                case optionQuit:
                    await this.closeClient();
                    throw Quit;
                default:
                    return;
            }
        } while (true);
    }

    private async findCaseConflicts(client: Client): Promise<void> {
        const tree = await this.getTree(client);
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

    private async findProblematicCharacters(client: Client): Promise<void> {
        const tree = await this.getTree(client);
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

    private async findSymbolicLinkConflicts(client: Client): Promise<void> {
        const tree = await this.getTree(client);
        let report = '';

        const analyzeSymbolics = (
            parentPath: string,
            links: File[] | undefined,
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

    private async closeClient(): Promise<void> {
        if (this._client) {
            await this._client.end();
            this._client = undefined;
        }
    }

    private async getClient(): Promise<Client> {
        if (!this._client) {
            this._client = new sftp();
            await this._client.connect({
                host: this.config.ftp.host,
                port: this.config.ftp.port,
                username: this.config.ftp.username,
                password: this.config.ftp.password,
            });
        }
        return this._client;
    }

    private async getTree(client: Client): Promise<Tree> {
        if (this.tree) {
            return this.tree;
        }

        const scanDir = async (dir: string, parent: Tree) => {
            const fileInfos = await client.list(dir);
            parent.directories = fileInfos
                .filter((info) => info.type === 'd')
                .map<Directory>((info) => {
                    return {
                        name: info.name,
                    };
                });
            parent.files = fileInfos
                .filter((info) => info.type === '-')
                .map<File>((info) => {
                    return {
                        name: info.name,
                    };
                });
            parent.links = fileInfos
                .filter((info) => info.type === 'l')
                .map<File>((info) => {
                    return {
                        name: info.name,
                    };
                });

            if (parent.directories?.length > 0) {
                for (const subDir of parent.directories) {
                    await scanDir(dir + subDir.name + '/', subDir);
                }
            }
        };

        this.tree = {};
        await scanDir('/', this.tree);
        return this.tree;
    }
}
