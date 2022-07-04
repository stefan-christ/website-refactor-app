import { Inject, Injectable } from '@nestjs/common';
import * as path from 'path';
import sftp from 'ssh2-sftp-client';
import { Directory, File, Link, Tree } from '../file-provider/file-model';
import { FtpConfig, FTP_CONFIG } from './ftp-config';

type Client = sftp;

@Injectable()
export class FtpService {
    constructor(
        @Inject(FTP_CONFIG) private readonly configuration: FtpConfig,
    ) {}

    private getFileExtension(fileName: string): string {
        let extension = path.extname(fileName);
        if (extension === '') {
            if (fileName.startsWith('.')) {
                extension = fileName;
            }
        }
        return extension;
    }

    private async closeClient(client: Client): Promise<void> {
        if (client) {
            await client.end();
        }
    }

    private async getClient(): Promise<Client> {
        const client = new sftp();
        await client.connect({
            host: this.configuration.host,
            port: this.configuration.port,
            username: this.configuration.username,
            password: this.configuration.password,
        });
        return client;
    }

    async getTree(): Promise<Tree> {
        const scanDir = async (
            client: Client,
            parentDir: Directory,
            dirPath: string,
        ) => {
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
                        client,
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
        let client: Client;
        try {
            client = await this.getClient();
            await scanDir(client, tree, '/');
        } finally {
            try {
                await this.closeClient(client);
            } catch (error) {
                // silence
            }
            client = undefined;
        }

        return tree;
    }
}
