import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, APP_CONFIG } from '../../app-config';
import { FileProviderService } from '../file-provider/file-provider.service';
import { IoService } from '../io/io.service';

@Injectable()
export class ReportService {
    constructor(
        @Inject(APP_CONFIG) private readonly configuration: AppConfig,
        private readonly fileProvider: FileProviderService,
        private readonly io: IoService,
    ) {}

    getTimestamp(): string {
        let ts = new Date()
            .toISOString()
            .replace('T', ' ')
            .replace(':', '.')
            .replace(':', '.')
            .substring(0, 19);
        return ts;
    }

    async getReportDirPath(): Promise<string | undefined> {
        const currentType = this.fileProvider.getCurrentType();
        if (!!currentType) {
            let dirName: string;
            switch (currentType) {
                case 'ftp':
                    dirName = 'ftp';
                    break;
                case 'www':
                    dirName = 'www';
                    break;
                default:
                    dirName =
                        'custom (' + this.io.getNameFromPath(currentType) + ')';
                    break;
            }
            let path = this.io.join(this.configuration.workingDir, dirName);
            if (this.configuration.timestamp === 'folder') {
                path = this.io.join(path, this.getTimestamp());
            }
            await this.io.ensureDirectory(path);
            return path;
        }
        return undefined;
    }

    async prepareDirectory(...pathSegments: string[]): Promise<void> {
        const dir = await this.getReportDirPath();
        const reportDirPath = this.io.join(dir, ...pathSegments);

        await this.io.rimraf(reportDirPath);
        await this.io.ensureDirectory(reportDirPath);
    }

    async writeTextReport(
        data: string,
        ...pathSegments: string[]
    ): Promise<void> {
        const dir = await this.getReportDirPath();
        const reportFilePath = this.io.join(dir, ...pathSegments);
        await this.io.writeTextFile(reportFilePath, data);
    }

    async writeJsonReport(
        data: unknown,
        ...pathSegments: string[]
    ): Promise<void> {
        const dir = await this.getReportDirPath();
        const reportFilePath = this.io.join(dir, ...pathSegments);
        await this.io.writeJsonFile(reportFilePath, data);
    }
}
