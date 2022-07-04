import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import * as path from 'path';
import sftp from 'ssh2-sftp-client';
import { Directory, File, Link, Tree } from '../file-provider/file-model';
import { FtpConfig, FTP_CONFIG } from './ftp-config';

type Client = sftp;

@Injectable()
export class FtpService implements OnModuleDestroy {
    private _client: Client;

    constructor(
        @Inject(FTP_CONFIG) private readonly configuration: FtpConfig,
    ) {}

    async onModuleDestroy(): Promise<void> {
        return this.closeClient();
    }

    private getFileExtension(fileName: string): string {
        let extension = path.extname(fileName);
        if (extension === '') {
            if (fileName.startsWith('.')) {
                extension = fileName;
            }
        }
        return extension;
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
                host: this.configuration.host,
                port: this.configuration.port,
                username: this.configuration.username,
                password: this.configuration.password,
            });
        }
        return this._client;
    }

    async getTree(): Promise<Tree> {
        const client: Client = await this.getClient();

        const scanDir = async (parentDir: Directory, dirPath: string) => {
            const fileInfos = await client.list(dirPath);

            const parentPath = parentDir.parentPath + parentDir.name + '/';

            parentDir.directories = fileInfos
                .filter((info) => info.type === 'd')
                .map<Directory>((info) => {
                    return {
                        name: info.name,
                        parentPath,
                    };
                });
            parentDir.files = fileInfos
                .filter((info) => info.type === '-')
                .map<File>((info) => {
                    return {
                        name: info.name,
                        parentPath,
                        extension: this.getFileExtension(info.name),
                    };
                });
            parentDir.links = fileInfos
                .filter((info) => info.type === 'l')
                .map<Link>((info) => {
                    return {
                        name: info.name,
                        parentPath,
                    };
                });

            if (parentDir.directories?.length > 0) {
                for (const subDir of parentDir.directories) {
                    await scanDir(
                        subDir,
                        subDir.parentPath + '/' + subDir.name,
                    );
                }
            }
        };

        const tree: Tree = {
            name: '',
            parentPath: '',
            type: 'remote',
            pathSeparator: '/',
        };
        await scanDir(tree, '/');
        return tree;
    }
}
