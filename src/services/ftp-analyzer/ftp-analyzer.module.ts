import { Module } from '@nestjs/common';

import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { FileProviderModule } from '../file-provider/file-provider.module';
import { IoModule } from '../io/io.module';
import { FtpAnalyzerService } from './ftp-analyzer.service';

@Module({
    imports: [ConfigurationModule, CliModule, IoModule, FileProviderModule],
    providers: [FtpAnalyzerService],
    exports: [FtpAnalyzerService],
})
export class FtpAnalyzerModule {}
