import { Module } from '@nestjs/common';
import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { FtpModule } from '../ftp/ftp.module';
import { IoModule } from '../io/io.module';

import { FileProviderService } from './file-provider.service';

@Module({
    imports: [CliModule, FtpModule, IoModule, ConfigurationModule],
    providers: [FileProviderService],
    exports: [FileProviderService],
})
export class FileProviderModule {}
