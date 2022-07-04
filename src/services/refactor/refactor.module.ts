import { Module } from '@nestjs/common';
import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { FileProviderModule } from '../file-provider/file-provider.module';
import { ReportModule } from '../report/report.module';
import { RefactorService } from './refactor.service';

@Module({
    imports: [ConfigurationModule, FileProviderModule, ReportModule, CliModule],
    providers: [RefactorService],
    exports: [RefactorService],
})
export class RefactorModule {}
