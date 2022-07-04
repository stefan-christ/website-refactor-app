import { Module } from '@nestjs/common';

import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { FileProviderModule } from '../file-provider/file-provider.module';
import { ReportModule } from '../report/report.module';
import { AnalyzerService } from './analyzer.service';

@Module({
    imports: [ConfigurationModule, FileProviderModule, ReportModule, CliModule],
    providers: [AnalyzerService],
    exports: [AnalyzerService],
})
export class AnalyzerModule {}
