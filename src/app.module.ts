import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AnalyzerModule } from './services/analyzer/analyzer.module';
import { CliModule } from './services/cli/cli.module';
import { ConfigurationModule } from './services/configuration/configuration.module';
import { FtpAnalyzerModule } from './services/ftp-analyzer/ftp-analyzer.module';
import { IoModule } from './services/io/io.module';
import { RefactorerModule } from './services/refactorer/refactorer.module';

@Module({
    imports: [
        IoModule,
        CliModule,
        FtpAnalyzerModule,
        ConfigurationModule,
        AnalyzerModule,
        RefactorerModule,
    ],
    providers: [AppService],
})
export class AppModule {}
